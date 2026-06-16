# Release Notes - v1.3.17

This release adds support for a configurable auto-expand trigger prefix to bypass iPadOS Smart Punctuation issues, improves drag-and-drop compatibility on PC clients, and cleans up the codebase structure.

## New Features & Fixes

### 1. Configurable Auto-Expand Trigger Prefix (iPad Fix)
- Adds a setting under the **Auto-Expand** tab to choose the character prefix that triggers auto-expansion.
- Supported prefixes include: `--`, `..`, `//`, `;;`, `,,`, and `@@`.
- Setting a prefix like `..` or `//` bypasses iPadOS's Smart Punctuation behavior which automatically converts double hyphens (`--`) into dashes, breaking the auto-expand shortcuts.
- Update dynamically generated preview prompts in the settings pane.

### 2. Drag & Drop on PC
- Fixes drag-and-drop functionality on PC/Desktop Electron clients by declaring proper CSS webkit drag properties on verse numbers.
- Prevents text selection from clearing when initiating drags.

### 3. Codebase Cleanups
- Removed dead and obsolete scripts and source files to streamline build output.
