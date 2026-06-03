# Design Philosophies

This document outlines the core architectural and design guidelines of the Bible Sidecar Plus plugin.

## 1. User Feedback & Responsiveness
- Settings panel inputs (especially API keys) must provide immediate validation and connection status feedback.
- Network requests should show explicit loading indicators or disabled states on buttons.
- Errors should be descriptive and helpful, avoiding silent failures.

## 2. Privacy & Offline-First Design
- Personal data, including API keys, must be stored locally in the Obsidian vault configuration.
- Where possible, downloaded content must be cached locally to allow for offline usage.
- Premium API fallback to public sources (like bolls.life) must be seamless.

## 3. HTML Parsing & Text Extraction
- When parsing scripture from external APIs (like Crossway ESV or API.Bible), the parser must robustly handle nested DOM structures (such as verse number spans wrapped inside outer verse spans) to ensure no verse text is lost.
