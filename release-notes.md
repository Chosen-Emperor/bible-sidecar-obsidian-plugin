# Release Notes — v1.3.18

This release is a major quality-of-life update focused on a completely redesigned **IntelliSense autocomplete engine**, improved **note-writing workflows**, and a clean **consolidated settings panel**. Every interaction with the Bible reference system has been sharpened.

---

## 🧠 IntelliSense Autocomplete Engine (Major Overhaul)

### ✅ Cursor Placed at End of Inserted Text
After selecting an autocomplete item, the editor cursor is now positioned at the very end of the inserted text — not the beginning. This means you can immediately continue typing without any clicking.

### ✅ Tab Key Autocomplete
Pressing **Tab** now selects the currently highlighted suggestion, just like **Enter**. You can configure a hotkey to open the IntelliSense context window via Ctrl+P → "Autocomplete Bible Scripture (IntelliSense)".

### ✅ Suggestions Survive Trailing Colons
When you type a colon after a chapter number (e.g. `--Job 1:`), the suggestion window **no longer disappears**. Instead, it immediately suggests the first several verses of that chapter to help you pick one without guessing.

### ✅ Suggestions Survive Trailing Dashes (Range Ranges)
Similarly, typing a dash after a verse (e.g. `--John 3:16-`) keeps the window open and suggests common verse ranges starting from your position — e.g. `16-17`, `16-18`, etc.

### ✅ Number-First Suggestions (Active Sidecar Context)
When a Bible chapter is open in the Sidecar panel, typing a number (e.g. `--3`) will now **prioritize the active book and chapter context** over generic book name matches. This makes quickly inserting verses from the passage you're reading much faster.

### ✅ Format Suffix Shortcuts Without `+`
You can now append the format shortcode directly to your query without the `+` symbol. For example:
- `--John 3:16p` → Passage (inline) style
- `--John 3:16l` → List (newline) style
- `--John 3:16q` → Quote (scripture-only) style

The `+` is now optional — both `16p` and `16+p` work identically.

---

## 📝 Shorthand Verse References (Context Links)

When writing notes alongside an open chapter in the Sidecar, you can now use **verse shorthand** to insert a compact hyperlink reference. Type `--v2` (or `--2`) and IntelliSense will resolve it to the corresponding verse in the currently active chapter and insert a clean shorthand link like:

```
[v2](obsidian://bible-sidecar-plus?...)
```

This prevents note clutter when the full reference (e.g. `Matthew 3:2`) would be repetitive.

---

## 🔧 Settings Panel — Fully Reorganized

The settings page has been rebuilt from 7 scattered tabs into **4 clearly scoped groups**:

### 📖 Reader & Sidecar View
Everything controlling how you *read*:
- Bible language & translation selection
- Parallel translation toggle and secondary version
- Sidecar display options (verse separation, book name abbreviation, link icon visibility, offline glow accents)
- Study tools: cross-references, red-letter words (Gospels), Strong's Concordance
- Developer logging and factory reset

### 🌐 Translations & APIs
Everything about *where text comes from*:
- Offline translation download manager with progress bar
- ESV API (Crossway) key entry with live connection test
- API.Bible key entry, auto-fetch of version list, and version selector

### 📋 Copy & Formatting
Everything about *how text is copied*:
- Copy format: plain text vs. callout block
- Reference prefix style, full/short format, and internal wiki-link toggling

### 🧠 Autocomplete (IntelliSense)
Everything about *how autocomplete behaves and looks*:
- Enable/disable toggle and trigger prefix selector
- Default expansion reference style
- **Custom icon emoji** and **1-word descriptor** per suggestion type (Link, Passage, List, Quote, Book)
- **Show/Hide Word Descriptor** global toggle — turn off to show only icons in the suggestions list
- Per-flag (`+p`, `+l`, `+q`) formatting templates including callout wrapping, callout color, and title templates
- Live formatting preview card (John 3:16-17) updated in real time
- Built-in keyboard shortcuts cheatsheet

---

## 🐛 Bug Fixes

### Trailing Colon on Whole-Book References
References like `--Job` (entire book) previously generated malformed links with a stray colon — e.g. `Job 1:`. This has been fixed. Whole-book and whole-chapter links now format cleanly without a trailing colon.

### Drag-and-Drop Preserved
Drag-and-drop functionality from the Sidecar verse list into editor notes has been re-verified and is working correctly on both desktop and mobile.

---

## 🧪 Test Coverage

- **198 unit tests** all passing across autocomplete parsing, suggestion ranking, reference formatting, offline caching, cross-references, Strong's concordance, and more.
