# Intercept Native Text Selection Drag for Custom Markdown Citations

We decided to intercept the native browser `dragstart` event on the **Bible Sidecar** when a text selection is active, parsing the selection range to dynamically compile a rich formatted Markdown payload with superscript verse boundaries and passage citations.

## Context

When users highlight text on mobile or desktop and drag it into their Obsidian notes, they expect the dragged snippet to include proper formatting and citations (e.g., quote headers, wiki-links, and Bible Version markers). Implementing a custom click-to-highlight/multiselect UI would create a heavy UX overlay, especially on mobile where native selection handles are familiar and deeply integrated into the OS.

## Decision

Instead of custom annotation states, we hook into the browser's native text selection. A global `dragstart` event listener on the `chapterContent` container inspects `document.getSelection()`. If a selection is active, it:
1. Traces the selection's start and end nodes to the enclosing `.verse` or `.verse-inline` elements.
2. Identifies the Bible Version of origin (handling parallel columns natively via `data-primary` tagging).
3. Extracts character slices per verse, inserting superscript verse markers at verse boundaries for multi-verse selections.
4. Formats the output based on existing copying and citation settings.
5. Overwrites the drag transfer data using `e.dataTransfer.setData("text/plain", dragText)`.

This keeps the codebase lightweight, respects native OS touch selection handles on mobile devices, and unifies copying and dragging formatting behaviors.
