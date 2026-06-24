# 🔖 AI Chat Bookmarks

An elegant, platform-agnostic Chrome Extension that eliminates **"Context Window Fatigue"** by letting you manually bookmark, label, color-code, and instantly navigate key milestones in your AI conversations. 

Works seamlessly across **Claude, ChatGPT, Gemini, and Grok**.

---

## 💡 The Core Problem: "Context Window Fatigue"
As LLM context windows expand to 1M+ tokens, users are having longer, more complex conversations. However, browser scrollbars are linear and blind. When working on a complex coding project, a long creative writing session, or deep research, finding a past milestone (e.g., *"where we fixed the auth bug"* or *"where we outlined Section 3"*) requires endless, exhausting scrolling.

**AI Chat Bookmarks** solves this by layering a manual, developer-grade "minimap" right on top of your native browser scrollbar.

---

## ✨ Features

*   **🌐 Platform-Agnostic & Synced UI:** 
    *   Works natively on **Claude.ai**, **ChatGPT.com**, **Gemini.google.com**, and **Grok.com**.
    *   Automatically detects the active AI platform and adapts the floating bookmark button's accent glow to match their branding (Claude Orange, ChatGPT Teal, Gemini Blue, Grok Dark/Blue).
    *   Applies a distinct, custom-tailored color palette for your bookmark dots depending on the host platform.
*   **🕶️ Stealth Mode (Double-Click Toggle):** 
    *   By default, the extension keeps your UI completely clean.
    *   Double-click the floating `🔖` button to instantly toggle all your scrollbar bookmark dots on or off.
*   **📁 Quick-Access Hover Panel:**
    *   Hover over the floating `🔖` button for half a second to open a glassmorphism list of all bookmarks in the current chat. 
    *   Clicking a list item scrolls you directly to that section.
*   **🎯 Dynamic Alignment & Laser Pointer:**
    *   Clicking a dot scrolls the page and shoots a dynamic, diagonal glowing pointer line connecting the dot directly to the target message box.
    *   The line dynamically rotates and scales as the page smooth-scrolls, fading away after 2.5 seconds.
*   **✏️ Double-Click to Rename:**
    *   Double-click any bookmark dot to spawn an inline rename field right next to it. Type a new name and hit `Enter` to update.
*   **🗑️ Drag-to-Delete:**
    *   Drag unwanted bookmark dots directly onto the floating `🔖` logo to instantly delete them with a visual hover trash warning.
*   **💾 Permanent Local Storage:**
    *   All bookmarks are keyed by their specific AI platform chat IDs (e.g., `claude_uuid` vs `gemini_uuid`). They persist through page reloads and back/forward navigation.

---

## 🛠️ Installation

Since this is currently in developer testing phase, you can load it as an unpacked extension:

1. Clone this repository or download the source files.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle the **Developer mode** switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `bookmark` folder containing the code.
6. Open your favorite AI chatbot and start bookmarking!

---

## 💻 Tech Stack & Architecture

*   **Manifest V3:** Optimized and secure Chrome extension architecture.
*   **Vanilla JS (content.js):** Zero dependencies. Uses a fast MutationObserver to monitor URL/SPA switches and recalculate scroll offsets.
*   **Vanilla CSS (styles.css):** Glassmorphism aesthetic featuring CSS custom properties, custom hardware-accelerated animations (`requestAnimationFrame`), and responsive placement.
*   **Local Storage Engine:** Uses `chrome.storage.local` to securely persist user data without external database dependencies.

---

## 🧠 CEO, User & Investor Perspective

### 📈 Why Users Love It:
It acts as a mental anchor. Instead of dreading long threads, users can push AI conversations to 100+ turns because they can jump between reference points (e.g., system prompt edits, code iterations, research outline) in 1 click.

### 💼 Why AI Companies (CEOs/Product Managers) Care:
*   **Higher Retention:** Users stay in single threads longer, reducing chat fragmentation.
*   **Lower Token Costs:** Users don't have to restart new chats (re-sending system prompts/files) just because they "got lost" in their current long thread. This optimizes API/inference load.
*   **Pro Workspace Utility:** Bridges the gap between a consumer chat interface and a developer workspace environment.

---

## 📜 License
MIT License. Feel free to modify and adapt. Created by [Satwika Abbu](https://github.com/SatwikaAbbu).
