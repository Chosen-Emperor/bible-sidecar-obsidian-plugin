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

## 4. Testing Architecture & Agent Guidelines
- **Strict Separation of Concerns**: Core business logic, range expansion algorithms, text formatting, cache manipulation structures, and search filtering must be implemented as pure, exportable functions in [utils.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/utils.ts) (or pure modules). They must not be tightly coupled to Obsidian subclasses (`Plugin`, `ItemView`) or browser-specific objects (`DOMParser`, `document`).
- **No Test Simulations (Anti-Pattern Guard)**: Future agents must *never* copy-paste, duplicate, or simulate production code locally within test runners (e.g., [run-tests.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/run-tests.ts)). If a feature requires testing, its pure logic must be extracted from production classes, exported, and imported directly into the test suite. Testing local simulation replicas is strictly prohibited.
- **Thorough Test Coverage**: All utility engines must have corresponding assertion blocks in the unit test suite.
- **Network Isolation in Unit Tests**: Unit tests must execute quickly and without external network dependencies. For checking third-party schema drifts or live responses, leverage the release-gated [run-api-tests.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/run-api-tests.ts) suite separately.
