# Development Constraints & Rules

To maintain codebase health, lightweight size, and cross-platform compatibility, all developers (and AI agents) must strictly follow these rules.

---

## 1. Third-Party Library & Framework Constraints

- **No External UI Frameworks**: Do not introduce frameworks like React, Vue, or Svelte. The plugin UI is built entirely using Obsidian's native DOM creation helpers (`createEl()`, `createDiv()`) and Vanilla CSS.
- **No Utility Frameworks (Tailwind, Lodash)**: Avoid utility CSS frameworks like Tailwind or JS helper libraries like Lodash to keep the compiled bundle (`main.js`) small. Use standard JavaScript/TypeScript and Vanilla CSS.
- **Dependency Cleanliness**: Keep devDependencies lightweight. Compilation is performed solely with ESBuild.

---

## 2. Strict Testing Rules

- **No Test Simulations (Anti-Pattern Guard)**: You must *never* copy, simulate, or duplicate production code locally within test runners (e.g. `run-tests.ts`). If a feature requires testing, its logic must be extracted as a pure, platform-independent function in `utils.ts` and imported directly.
- **Network Isolation in Unit Tests**: Unit tests must execute quickly and without external internet dependencies. API mocks or static test fixtures should be used to simulate network calls.
- **API Schema Drift**: For validating third-party endpoint changes, keep API tests inside `run-api-tests.ts` which runs on-demand or during release workflows (not as part of regular unit tests).

---

## 3. DOM & State Management Rules

- **Unified Repaint Rule**: Do not paint Annotations (highlight colors or study note icons) directly into the DOM from interactive event listeners. All Annotations *must* be painted via the centralized `applySavedHighlights()` function inside `BibleView.ts` to ensure consistency.
- **Debounced Save Rule**: Avoid calling Obsidian's `saveData()` directly. Always trigger configuration updates via `saveSettings()`, which implements a 400ms debounce timer to prevent write thrashing.
- **Mobile Icon Safety**: Never call `setIcon()` directly on elements without wrapping it in `safeSetIcon()`. Mobile environments (WebKit container) have a known bug where SVG icons fail to render; `safeSetIcon()` provides Unicode emoji fallbacks to guarantee UI visibility.

---

## 4. Code Standards & Architecture Alignment

- **Pure Business Logic**: Any utility logic, parsing, string formatting, search matchers, or data mutations must reside in `utils.ts` as pure functions. Keep view manipulation logic in `BibleView.ts` and initialization logic in `main.ts`.
- **Pre-commit Checklist**: Before proposing changes or committing code, verify the following command outputs:
  - `npm run build` (Ensures Type compilation checks pass and ESBuild runs cleanly)
  - `npm run test` (Ensures all unit assertions pass)
