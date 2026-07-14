# 📖 Bible Sidecar Plus for Obsidian

[![Obsidian Version](https://img.shields.io/badge/Obsidian-v0.15.0%2B-purple.svg)](https://obsidian.md)
[![Latest Release](https://img.shields.io/github/manifest-json/v/Chosen-Emperor/bible-sidecar-obsidian-plugin?color=blue)](https://github.com/Chosen-Emperor/bible-sidecar-obsidian-plugin/releases)
[![Build Status](https://img.shields.io/badge/build-passing-success.svg)](#-development)
[![License](https://img.shields.io/github/license/Chosen-Emperor/bible-sidecar-obsidian-plugin?color=green)](LICENSE)

A premium, feature-rich **Bible Reader and Study Panel** for Obsidian. This is an enhanced fork of the original [Bible Sidecar](https://github.com/janisringli/bible-sidecar-obsidian-plugin) plugin, rewritten to support robust local **Offline Caching**, a high-performance **Offline Search Engine**, and responsive touch layouts for both Desktop and Mobile.

Designed to feel responsive, fast, and native across **Windows, macOS, Linux, iPad, iOS, and Android**.

<img width="1492" height="968" alt="Obsidian Bible Sidecar Plus Showcase" src="https://github.com/user-attachments/assets/78d8b443-149e-4a3d-84b7-22d898ca8478" />

---

## ✨ Features

### ⚡ Split-Screen Bible Sidecar
* **Side-by-Side Reading**: Keep your active notes open on the left and read scriptures in a split-screen view on the right.
* **Dual Translation Parallel View**: Compare two versions side-by-side (e.g., KJV & ESV). If your screen or pane becomes narrow (under `480px`), the layout automatically collapses into a tabbed layout for an optimal mobile experience.

### 🔍 Advanced Offline Search Engine
* Search your downloaded translations instantly using logical operators:
  * `loved world` — matches verses containing both terms.
  * `"only Son"` — searches for the exact phrase.
  * `world -condemn` — filters out verses containing "condemn".
  * `ot:light` / `nt:light` — restricts search to the Old or New Testament.
  * `JHN:world` — restricts search to a specific book (using standard 3-letter codes).

### 📝 Auto-Expand Shortcuts (IntelliSense)
Easily insert scripture and reference links directly inside your note editor using the native autocomplete suggest menu:
* **Trigger Prefix**: Type `--` followed by a book name (e.g. `--John 3:16`) to open the dropdown suggestions list.
* **Dropdown Selection Modes**:
  * **Link** (default) $\rightarrow$ Inserts a clean markdown link (e.g. `[[John 3:16]]`).
  * **Passage** (`p`) $\rightarrow$ Inserts the scripture text with superscript links, followed by the reference link at the bottom.
  * **Quote** (`q`) $\rightarrow$ Inserts the scripture text (ideal for short, inline quotes).
  * **List** (`l`) $\rightarrow$ Inserts each verse on a new line with its superscript link, followed by the reference link at the bottom.
* **Quick Suffix Filtering**: Type `--John 3:16p` (or `+p`), `--John 3:16q`, or `--John 3:16l` to filter directly to that style, then press **Enter** or **Tab** to expand.
* **IntelliSense Auto-Complete**: Type `--John 3:` to pick from list of verses, or type `--John 3:16-` to select from consecutive verse ranges.
* **Double-Enter Spam Lock**: Safety locking built-in to prevent double-insertions or duplication even if you spam the enter key.

### 🔴 Words of Christ in Red (Gospel Accents)
* Automatically highlights all spoken words of Jesus in **red** inside the Gospels (Matthew, Mark, Luke, John). Compatibility is built-in for modern translations using standard quotation styles (e.g., ESV, NIV, NLT, NASB).

### 🌐 Offline Downloader & Outage Protection
* **Download Manager**: Save complete translations locally (via Bolls.life) for full offline search and reading.
* **Outage Fallback**: If you're using online APIs (like Crossway's ESV or API.Bible) and your internet drops, the plugin automatically switches to your offline cached fallback to prevent disruptions.

### 🏷️ Translation Version Indicators
* Optional small version badges (e.g., `ESV` or `KJV`) displayed inside the Sidecar navigation header.
* Appends active version tags inside Callout expansions (e.g. `[!quote] John 3:16 (ESV)`) so you always know which translation is referenced in your study notes.

---

## 🎨 Visual Preview of Expansion Modes

Here is what Callout expansions look like inside your Obsidian notes when using formatting shortcuts:

```markdown
> [!quote] Scripture: John 3:16 (ESV)
> [¹](obsidian://bible?book=John&chapter=3&verse=16) "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life."
```

Or for multiple verses with a bulleted List expansion:

```markdown
> [¹⁶](obsidian://bible?book=John&chapter=3&verse=16) For God so loved the world...
> [¹⁷](obsidian://bible?book=John&chapter=3&verse=17) For God did not send his Son...
> — [John 3:16-17](obsidian://bible?book=John&chapter=3&verse=16,17) (ESV)
```

---

## 🚀 How to Use

1. **Open the Sidecar**: Click the **Bible Icon** in the ribbon sidebar or run the Command Palette (`Open Bible Sidecar`).
2. **Offline Mode**: Navigate to settings, go to the **Translations & API Keys** tab, choose your version, and hit **Download** to cache the translation locally.
3. **Copying Verses**:
   * Click the **Copy Icon** next to any verse to copy it using your active formatting settings.
   * Highlight text directly in the Sidecar, press `Ctrl+C` / `Cmd+C`, and the copied text will automatically append the correct passage reference link!
4. **Drag & Drop**: Grab the superscript number of any verse in the Sidecar and drag it directly into your note editor.
5. **Auto-Suggestions**: Type `--` followed by a book name (e.g., `--Romans 8:28`) and select options from the suggestion list.

---

## ⚙️ Settings Configuration

The settings panel is organized into clean, easy-to-use tabs:

| Tab Section | Customizable Features |
| :--- | :--- |
| **General** | Configure language settings, book abbreviations, and toggle separate/paragraph verse layout modes. |
| **Translations & API Keys** | Setup connection keys for **Crossway's ESV API** or **API.Bible** (allowing poetry/indents), and download offline translation packages. |
| **Copy Options** | Setup clipboard copy behaviors, wiki-linking (`[[John]]`), reference styles (e.g. prefix `> ` or `-`), and callout settings. |
| **Auto-Expand Options** | Customize trigger prefixes (`--` or `//`), toggle word descriptors, and set up colors, titles, and styles for `+p`, `+l`, and `+q` expansions. |
| **Study Tools** | Turn on Jesus's words in red, toggle Strong's concordance numbers, and adjust cross-references. |

---

## 🛠️ Development & Contributing

If you want to build and modify the plugin locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/Chosen-Emperor/bible-sidecar-obsidian-plugin.git
   cd bible-sidecar-obsidian-plugin
   ```
2. Install the developer dependencies:
   ```bash
   npm install
   ```
3. Run the development server (auto-recompiles on file edits):
   ```bash
   npm run dev
   ```
4. Build the final optimized production bundle:
   ```bash
   npm run build
   ```
5. Run the unit test suite:
   ```bash
   npm run test
   ```
6. Run the online API compliance test suite (verifies compatibility with remote endpoints):
   ```bash
   npm run test:api
   ```


---

## 🤝 Contributing

Contributions are always welcome! If you encounter a bug, have a feature suggestion, or want to improve styles/translations, feel free to open a Pull Request or create an issue in our [GitHub Issues](https://github.com/Chosen-Emperor/bible-sidecar-obsidian-plugin/issues) page.

---

> [!NOTE]
> **Credits & Authorship**
> - Originally created and developed by [Janis Ringli](https://github.com/janisringli). (If you appreciate the core plugin, consider [buying him a coffee](https://buymeacoffee.com/janisringli)!)
> - Enhanced and maintained by [Chosen-Emperor](https://github.com/Chosen-Emperor) with mobile compatibility, offline caching, and layout polishing, developed in collaboration with AI assistance.
