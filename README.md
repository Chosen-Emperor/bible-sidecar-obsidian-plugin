# 📖 Bible Sidecar Plus for Obsidian

A premium, feature-rich Bible reader and integration panel for Obsidian. This is an enhanced fork of the original [Bible Sidecar](https://github.com/janisringli/bible-sidecar-obsidian-plugin) plugin by Janis Ringli, developed to support offline databases, full-text offline search, and touch-friendly mobile layouts. Refined with the assistance of advanced AI.

Designed to feel responsive, fast, and native across both Desktop and Mobile (iPad/iOS/Android).

---

## ✨ Features

- **⚡ Split-Screen Sidebar**: Keep your preferred scripture translations open side-by-side with your active notes.
- **🔍 Fast Offline Search**: Search the entire Bible offline using any word or phrase (requires downloaded translations).
- **📝 Auto-Expand Reference Shortcuts**: Type reference patterns like `--John 3:16` or `--John 3:16 +p` to automatically fetch and expand the full verse content directly into your editor.
- **📋 Premium Formatting & Copy Styles**:
  - Copy verses as plain text or nested Obsidian Callouts.
  - Customize prefixes (e.g., list bullets `-`, callouts `>`, tildes `~`).
  - Toggle automatic Wiki-linking (`[[John]]`) for verse references.
- **🔴 Words of Christ in Red**: Turn on Gospel red-letter formatting for words spoken by Jesus (works for translations with quotation marks, e.g., ESV, NIV, NLT, NASB).
- **🌐 Offline Downloader**: Download free translations (via Bolls.life) for full offline search and reading.
- **🔌 Premium API Integration**: Supports connection to **Crossway's ESV API** and **API.Bible** for premium layouts (poetry, paragraphs, etc.).

---

## 🚀 How to Use

1. **Open the Sidecar Panel**: Click the **Bible Icon** in the ribbon sidebar or use the Command Palette (`Open Bible Sidecar`).
2. **Browse Scripture**: Select a book, choose a chapter, and browse verses.
3. **Copy Verses**:
   - Tap/click any verse's copy icon to save it with your custom formatting rules.
   - Select text directly in the sidebar, copy normally (`Ctrl+C` / `Cmd+C`), and it will copy with the formatted verse reference appended automatically.
4. **Drag & Drop**: Drag a verse card from the sidecar directly into any active note to drop the formatted scripture right there.
5. **Use Auto-Expand**:
   - Enable auto-expand in settings.
   - Type `--John 3:16 ` (ends with space) to output a clean markdown link.
   - Type `--John 3:16 +p ` or `--John 3:16 +q ` to expand the full text inline or as a callout block!

---

## ⚙️ Settings Configuration

| Setting | Description |
| :--- | :--- |
| **Bible Language & Version** | Select your language and download translations for offline use. |
| **Copy Format** | Toggle between copying as **Plain text** or wrapping scripture in a markdown **Callout**. |
| **Reference Prefix & Style** | Define how references are formatted (e.g., full book names or short abbreviations). |
| **Auto-Expand Shortcuts** | Setup custom formatting, callout styles, and colors for `+p`, `+l`, and `+q` expand tags. |
| **Gospel Words in Red** | Automatically styles all words of Christ in red (Gospel books only). |
| **Enable Logging** | Write raw parse/request logs to a debug file for troubleshooting. |

---

## 🛠️ Development

Follow these steps to build and modify the plugin locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/Chosen-Emperor/bible-sidecar-obsidian-plugin.git
   cd bible-sidecar-obsidian-plugin
   ```
2. Install the dev dependencies:
   ```bash
   npm install
   ```
3. Run the development server (watches files for changes):
   ```bash
   npm run dev
   ```
4. Build the final optimized production bundle:
   ```bash
   npm run build
   ```

### 🏛️ System Architecture & Onboarding

This codebase utilizes a centralized **Architectural Meta-Repository** inside the [.meta/](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/) directory. 

Before making any modifications or proposing new features:
1. Review the high-level architecture: [.meta/overview.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/overview.md)
2. Understand execution flows: [.meta/data_flow.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/data_flow.md)
3. Study previous technical decisions: [.meta/architectural_decisions.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/architectural_decisions.md)
4. Check constraints & rules: [.meta/constraints_and_rules.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/constraints_and_rules.md)

All future AI agents and contributors must follow the structured **onboarding checklist** in [.meta/instructions.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/instructions.md) before pushing code.

---

## 🤝 Contributing

Contributions are welcome! If you find a bug, have a feature suggestion, or want to contribute translations/styles, feel free to open a Pull Request or create an issue in the [Issues Page](https://github.com/Chosen-Emperor/bible-sidecar-obsidian-plugin/issues).

---

> [!NOTE]
> **Credits & Authorship**
> - Originally created and developed by [Janis Ringli](https://github.com/janisringli). (If you appreciate the core plugin, consider [buying him a coffee](https://buymeacoffee.com/janisringli)!)
> - Enhanced and maintained by [Chosen-Emperor](https://github.com/Chosen-Emperor) with mobile compatibility, offline features, and layout polishing, developed in collaboration with AI assistance.
