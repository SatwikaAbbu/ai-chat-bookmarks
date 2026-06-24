// ═══════════════════════════════════════════════════════
//  AI CHAT BOOKMARKS — Chrome Extension
//  content.js — runs on Claude, ChatGPT, Gemini, Grok
// ═══════════════════════════════════════════════════════

(function () {

  // ════════════════════════════
  //  PLATFORM DETECTION & BRAND COLORS
  // ════════════════════════════
  function getPlatform() {
    const host = location.hostname;
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'chatgpt';
    if (host.includes('gemini.google.com')) return 'gemini';
    if (host.includes('grok.com') || host.includes('x.com')) return 'grok';
    return 'default';
  }

  const PLATFORM = getPlatform();

  const PLATFORM_COLORS = {
    claude:  ['#d97757','#e8956d','#c4846b','#a85d3f','#dba88c','#f0c9a6'],
    chatgpt: ['#10a37f','#1a7f64','#ab68ff','#19c37d','#8e5bd6','#2dc58c'],
    gemini:  ['#4285f4','#ea4335','#fbbc04','#34a853','#8e24aa','#00897b'],
    grok:    ['#1DA1F2','#7856ff','#1d9bf0','#536471','#f91880','#71767b'],
    default: ['#d97757','#5b9bd5','#6abf7b','#c97ac9','#d4b84a','#5bb8c9']
  };

  const COLORS = PLATFORM_COLORS[PLATFORM] || PLATFORM_COLORS.default;

  let bpList      = [];
  let selColor    = COLORS[0];
  let pending     = null;
  let scrollEl    = null;
  let lastUrl     = location.href;
  let dragBp      = null;
  let dotsVisible = false;
  let saving      = false;

  // ════════════════════════════
  //  MULTI-PLATFORM SELECTOR
  // ════════════════════════════
  function getUserMessages(root) {
    if (!root) return [];
    const selectors = [
      '[data-testid="user-message"]',
      '[data-message-author-role="user"]',
      'user-query, [data-test-id="user-query"], .user-query',
      '[data-message-author="user"]'
    ];
    for (const sel of selectors) {
      try {
        const msgs = Array.from(root.querySelectorAll(sel));
        if (msgs.length > 0) return msgs;
      } catch (e) {}
    }
    return [];
  }

  // ════════════════════════════
  //  CHAT ID — Works on all platforms
  // ════════════════════════════
  function getChatId() {
    const path = location.pathname;
    const claude = path.match(/\/chat\/([^/?#]+)/);
    if (claude) return 'claude_' + claude[1];
    const gemini = path.match(/\/app\/([^/?#]+)/);
    if (gemini) return 'gemini_' + gemini[1];
    const gpt = path.match(/\/c\/([^/?#]+)/);
    if (gpt) return 'gpt_' + gpt[1];
    const grok = path.match(/\/grok\/([^/?#]+)/);
    if (grok) return 'grok_' + grok[1];
    return location.hostname + path;
  }

  // ════════════════════════════
  //  FIND SCROLL CONTAINER
  // ════════════════════════════
  function getScrollEl() {
    const msgs = getUserMessages(document);
    const msg = msgs[msgs.length - 1] || msgs[0];
    if (!msg) return null;
    let el = msg.parentElement;
    while (el && el !== document.body) {
      const s = window.getComputedStyle(el);
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') return el;
      el = el.parentElement;
    }
    return null;
  }

  // ════════════════════════════
  //  STORAGE (with deduplication)
  // ════════════════════════════
  function saveToStorage() {
    const id = getChatId();
    chrome.storage.local.get(['bpChats'], (res) => {
      const bpChats = res.bpChats || {};
      bpChats[id] = bpList;
      chrome.storage.local.set({ bpChats });
    });
  }

  function loadFromStorage(callback) {
    const id = getChatId();
    chrome.storage.local.get(['bpChats'], (res) => {
      const bpChats = res.bpChats || {};
      bpList = bpChats[id] || [];
      // Deduplicate by id
      const seen = new Set();
      bpList = bpList.filter(bp => {
        if (seen.has(bp.id)) return false;
        seen.add(bp.id);
        return true;
      });
      if (callback) callback();
    });
  }

  // ════════════════════════════
  //  BUILD MODAL (once)
  // ════════════════════════════
  function buildModal() {
    if (document.getElementById('bp-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'bp-overlay';
    ov.innerHTML = `
      <div id="bp-modal">
        <div class="bp-mhead">
          <div class="bp-micon">🔖</div>
          <div class="bp-mtitle">Add a bookmark</div>
        </div>
        <div class="bp-mdesc" id="bp-mdesc">What was this section about?</div>
        <div class="bp-mlabel">Bookmark name</div>
        <input id="bp-name-input" type="text" placeholder="e.g. Fixed the auth bug, Discussed UI design..." maxlength="60" autocomplete="off">
        <div class="bp-mlabel">Color</div>
        <div class="bp-colors" id="bp-colors"></div>
        <div class="bp-mactions">
          <button id="bp-skip-btn">Cancel</button>
          <button id="bp-save-btn">Save bookmark ↵</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    COLORS.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'bp-color-swatch' + (i === 0 ? ' bp-active' : '');
      d.style.background = c;
      d.onclick = () => {
        document.querySelectorAll('.bp-color-swatch').forEach(x => x.classList.remove('bp-active'));
        d.classList.add('bp-active');
        selColor = c;
      };
      document.getElementById('bp-colors').appendChild(d);
    });

    document.getElementById('bp-save-btn').onclick = doSave;
    document.getElementById('bp-skip-btn').onclick = () => { pending = null; closeModal(); };
    document.getElementById('bp-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); doSave(); }
      if (e.key === 'Escape') { pending = null; closeModal(); }
    });
  }

  // ════════════════════════════
  //  MODAL OPEN / CLOSE
  // ════════════════════════════
  function openModal() {
    const desc = document.getElementById('bp-mdesc');
    if (desc) desc.textContent = 'What was this section about?';
    const inp = document.getElementById('bp-name-input');
    if (inp) inp.value = '';
    const idx = bpList.length % COLORS.length;
    document.querySelectorAll('.bp-color-swatch').forEach((el, i) => el.classList.toggle('bp-active', i === idx));
    selColor = COLORS[idx];
    const ov = document.getElementById('bp-overlay');
    if (ov) ov.classList.add('bp-on');
    setTimeout(() => { const i = document.getElementById('bp-name-input'); if (i) i.focus(); }, 200);
  }

  function closeModal() {
    const ov = document.getElementById('bp-overlay');
    if (ov) ov.classList.remove('bp-on');
  }

  // ════════════════════════════
  //  SAVE BOOKMARK (with guard)
  // ════════════════════════════
  function doSave() {
    if (saving) return;
    const ov = document.getElementById('bp-overlay');
    if (!ov || !ov.classList.contains('bp-on')) return;
    saving = true;

    const inp  = document.getElementById('bp-name-input');
    const name = (inp ? inp.value.trim() : '') || 'Unnamed';
    const id   = `bp-anchor-${Date.now()}`;

    let msgIndex = 0;
    if (scrollEl) {
      const msgs = getUserMessages(scrollEl);
      msgIndex = Math.max(0, msgs.length - 1);
    }

    bpList.push({ name, color: selColor, id, msgIndex });
    saveToStorage();
    pending = null;
    closeModal();
    dotsVisible = true;
    updateToggleBtn();
    setTimeout(() => { renderDots(); saving = false; }, 150);
  }

  // ════════════════════════════
  //  DELETE BOOKMARK
  // ════════════════════════════
  function deleteBookmark(bp) {
    bpList = bpList.filter(b => b.id !== bp.id);
    saveToStorage();
    renderDots();
  }

  // ════════════════════════════
  //  RENAME BOOKMARK (double-click dot)
  // ════════════════════════════
  function renameBookmark(bp, dot) {
    const existing = document.getElementById('bp-rename-input');
    if (existing) existing.remove();

    // Hide tooltip on this dot while renaming
    dot.classList.add('bp-renaming');

    const input = document.createElement('input');
    input.id = 'bp-rename-input';
    input.type = 'text';
    input.value = bp.name;
    input.maxLength = 60;

    const dotRect = dot.getBoundingClientRect();
    input.style.cssText = `
      position: fixed;
      top: ${dotRect.top - 4}px;
      right: ${window.innerWidth - dotRect.left + 8}px;
      width: 180px;
      padding: 5px 10px;
      background: #1e1c1a;
      border: 1px solid ${bp.color};
      border-radius: 8px;
      color: #e8e4dc;
      font-size: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      z-index: 1000000;
      outline: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;

    document.body.appendChild(input);
    input.focus();
    input.select();

    function finishRename() {
      if (!input.isConnected) return;
      bp.name = input.value.trim() || 'Unnamed';
      saveToStorage();
      input.remove();
      renderDots();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finishRename(); }
      if (e.key === 'Escape') { input.remove(); renderDots(); }
      e.stopPropagation();
    });
    input.addEventListener('blur', finishRename);
  }

  // ════════════════════════════
  //  SCROLL TO BOOKMARK + ARROW
  // ════════════════════════════
  function scrollToBookmark(bp) {
    if (!scrollEl) scrollEl = getScrollEl();
    if (!scrollEl) return;

    const msgs = getUserMessages(scrollEl);
    const targetMsg = msgs[bp.msgIndex] || msgs[msgs.length - 1];
    if (!targetMsg) return;

    let targetOffsetTop = 0;
    let el = targetMsg;
    while (el && el !== scrollEl) {
      targetOffsetTop += el.offsetTop || 0;
      el = el.offsetParent;
      if (!el || el === document.body) break;
    }

    scrollEl.scrollTo({ top: Math.max(targetOffsetTop - 40, 0), behavior: 'smooth' });

    // Remove old arrows
    document.querySelectorAll('.bp-pointer-arrow').forEach(el => el.remove());

    // Create arrow line anchored to the dot
    const arrow = document.createElement('div');
    arrow.className = 'bp-pointer-arrow';
    arrow.style.background = bp.color;
    arrow.style.boxShadow = `0 0 6px ${bp.color}, 0 0 12px ${bp.color}`;
    document.body.appendChild(arrow);

    const head = document.createElement('div');
    head.className = 'bp-pointer-head';
    head.style.borderRightColor = bp.color;
    arrow.appendChild(head);

    const start = Date.now();
    function updateArrow() {
      const dot = document.querySelector(`.bp-scrolldot[data-bp-id="${bp.id}"]`);
      if (dot) {
        const dr = dot.getBoundingClientRect();
        arrow.style.top = (dr.top + dr.height / 2 - 1) + 'px';
        arrow.style.right = (window.innerWidth - dr.left + 4) + 'px';
      }
      if (Date.now() - start < 2500) {
        requestAnimationFrame(updateArrow);
      } else {
        arrow.remove();
      }
    }
    updateArrow();
  }

  // ════════════════════════════
  //  RENDER SCROLLBAR DOTS
  // ════════════════════════════
  function renderDots() {
    document.querySelectorAll('.bp-scrolldot').forEach(d => d.remove());
    if (!dotsVisible || !scrollEl) return;

    const rect  = scrollEl.getBoundingClientRect();
    const total = scrollEl.scrollHeight;
    if (total <= 0 || rect.height <= 0) return;

    bpList.forEach(bp => {
      const msgs = getUserMessages(scrollEl);
      if (msgs.length === 0) return;
      const targetMsg = msgs[bp.msgIndex] || msgs[msgs.length - 1];

      let targetOffsetTop = 0;
      if (targetMsg) {
        let el = targetMsg;
        while (el && el !== scrollEl) {
          targetOffsetTop += el.offsetTop || 0;
          el = el.offsetParent;
          if (!el || el === document.body) break;
        }
      }

      const pct = Math.min(Math.max(targetOffsetTop / total, 0.01), 0.99);
      const dotTop = rect.top + pct * rect.height;

      const dot = document.createElement('div');
      dot.className = 'bp-scrolldot';
      dot.style.background = bp.color;
      dot.style.top = dotTop + 'px';
      dot.style.right = '2px';
      dot.style.left = 'auto';
      dot.setAttribute('data-label', bp.name);
      dot.setAttribute('data-bp-id', bp.id);

      dot.onclick = () => scrollToBookmark(bp);

      dot.ondblclick = (e) => {
        e.stopPropagation();
        renameBookmark(bp, dot);
      };

      // Drag to delete
      dot.draggable = true;
      dot.addEventListener('dragstart', (e) => {
        dragBp = bp;
        dot.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        const btn = document.getElementById('bp-float-btn');
        if (btn) btn.classList.add('bp-drop-ready');
      });
      dot.addEventListener('dragend', () => {
        dot.style.opacity = '1';
        dragBp = null;
        const btn = document.getElementById('bp-float-btn');
        if (btn) btn.classList.remove('bp-drop-ready');
      });

      document.body.appendChild(dot);
    });
  }

  // ════════════════════════════
  //  TOGGLE DOTS
  // ════════════════════════════
  function toggleDots() {
    dotsVisible = !dotsVisible;
    updateToggleBtn();
    renderDots();
  }

  function updateToggleBtn() {
    const btn = document.getElementById('bp-float-btn');
    if (btn) btn.classList.toggle('bp-dots-active', dotsVisible);
  }

  // ════════════════════════════
  //  BOOKMARK PANEL (hover)
  // ════════════════════════════
  function showBookmarkPanel() {
    if (document.getElementById('bp-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'bp-panel';

    if (bpList.length === 0) {
      panel.innerHTML = '<div style="color:#6b6760;font-size:12px;text-align:center;padding:10px;">No bookmarks yet.<br>Click 🔖 to add one.</div>';
    } else {
      bpList.forEach(bp => {
        const item = document.createElement('div');
        item.className = 'bp-panel-item';
        item.innerHTML = `<div class="bp-panel-color" style="background:${bp.color}"></div><div class="bp-panel-name">${bp.name}</div>`;
        item.onclick = (e) => {
          e.stopPropagation();
          hideBookmarkPanel();
          if (!dotsVisible) { dotsVisible = true; updateToggleBtn(); renderDots(); }
          setTimeout(() => scrollToBookmark(bp), 100);
        };
        panel.appendChild(item);
      });
    }

    const btn = document.getElementById('bp-float-btn');
    if (btn) btn.appendChild(panel);
  }

  function hideBookmarkPanel() {
    const panel = document.getElementById('bp-panel');
    if (panel) panel.remove();
  }

  // ════════════════════════════
  //  FLOATING BUTTON
  // ════════════════════════════
  function buildFloatingButton() {
    if (document.getElementById('bp-float-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'bp-float-btn';
    btn.setAttribute('data-platform', PLATFORM);
    btn.innerHTML = '🔖';
    btn.title = 'Click: Add Bookmark · Double-Click: Toggle Dots · Hover: View All';

    // Single click = add bookmark, Double click = toggle dots
    let clickTimer = null;
    btn.addEventListener('click', (e) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; toggleDots(); return; }
      clickTimer = setTimeout(() => { clickTimer = null; triggerBookmark(); }, 250);
    });

    // Hover = show panel
    let hoverTimer = null;
    btn.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(showBookmarkPanel, 300);
    });
    btn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      setTimeout(() => {
        const panel = document.getElementById('bp-panel');
        if (panel && !panel.matches(':hover') && !btn.matches(':hover')) hideBookmarkPanel();
      }, 200);
    });

    // Drop zone for deleting bookmarks
    btn.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; btn.classList.add('bp-drop-hover'); });
    btn.addEventListener('dragleave', () => { btn.classList.remove('bp-drop-hover'); });
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('bp-drop-hover', 'bp-drop-ready');
      if (dragBp) { deleteBookmark(dragBp); dragBp = null; }
    });

    document.body.appendChild(btn);
  }

  function triggerBookmark() {
    scrollEl = getScrollEl();
    pending = {};
    openModal();
  }

  // ════════════════════════════
  //  KEYBOARD SHORTCUT
  // ════════════════════════════
  function startBookmarkSystem() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        triggerBookmark();
      }
    });

    const intv = setInterval(() => {
      if (!scrollEl) scrollEl = getScrollEl();
      if (scrollEl && !scrollEl.dataset.bpBound) {
        scrollEl.addEventListener('scroll', renderDots, { passive: true });
        scrollEl.dataset.bpBound = 'true';
        clearInterval(intv);
        renderDots();
      }
    }, 1000);
  }

  // ════════════════════════════
  //  WATCH FOR CHAT NAVIGATION
  // ════════════════════════════
  function watchNavigation() {
    const navObs = new MutationObserver(() => {
      if (location.href !== lastUrl) { lastUrl = location.href; onChatChange(); }
    });
    navObs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', onChatChange);
    const origPush = history.pushState.bind(history);
    history.pushState = function (...args) { origPush(...args); setTimeout(onChatChange, 300); };
  }

  function onChatChange() {
    bpList = []; pending = null; scrollEl = null; dotsVisible = false;
    document.querySelectorAll('.bp-scrolldot').forEach(el => el.remove());
    document.querySelectorAll('.bp-pointer-arrow').forEach(el => el.remove());
    const ri = document.getElementById('bp-rename-input'); if (ri) ri.remove();
    updateToggleBtn();
    loadFromStorage(() => {
      setTimeout(() => { scrollEl = getScrollEl(); renderDots(); }, 1000);
      setTimeout(() => { scrollEl = getScrollEl(); renderDots(); }, 3000);
    });
  }

  // ════════════════════════════
  //  RESIZE — reposition dots
  // ════════════════════════════
  window.addEventListener('resize', renderDots, { passive: true });

  // ════════════════════════════
  //  BOOT
  // ════════════════════════════
  function boot() {
    buildModal();
    buildFloatingButton();
    watchNavigation();
    setTimeout(() => {
      loadFromStorage(() => {
        startBookmarkSystem();
        setTimeout(() => { scrollEl = getScrollEl(); renderDots(); }, 2000);
      });
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
