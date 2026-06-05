# AI Agent & Developer Checklist

This file contains strict guidelines instructing future AI agents and developers on how they **MUST** approach modifications, additions, or debugging in this repository.

---

## 📋 The Implementation Checklist

You must perform these steps in order when working in this codebase:

### 1. Pre-Implementation Phase
- [ ] **Read the Architecture Overview**: Read [.meta/overview.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/overview.md) to understand directory structures and core components.
- [ ] **Review Constraints & Rules**: Read [.meta/constraints_and_rules.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/constraints_and_rules.md) to learn which styles, libraries, and coding patterns are banned.
- [ ] **Check ADR History**: Read [.meta/architectural_decisions.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/architectural_decisions.md) to ensure you do not undo historical decisions (e.g. scroll position cache or mobile Unicode icons).

### 2. Development Phase
- [ ] **Extract Pure Functions**: If you write core logic, search engines, parser patterns, or state compilers, write them as pure, exportable functions in [utils.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/utils.ts). Keep them free from `obsidian` imports.
- [ ] **UI Implementation**: If updating UI, implement it inside [BibleView.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/BibleView.ts) or [settings.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/settings.ts) using Vanilla CSS and native Obsidian DOM APIs.
- [ ] **Paint Safely**: Ensure any highlighting or custom annotation painting is integrated into the unified repaint path (`applySavedHighlights` in `BibleView.ts`).
- [ ] **Icon Fallbacks**: Use `safeSetIcon()` instead of raw `setIcon()` to guarantee mobile WebKit compatibility.

### 3. Verification Phase
- [ ] **Run Unit Tests**: Build the test runner and verify that all unit assertions pass:
  ```bash
  npm run test
  ```
- [ ] **Verify Bundle Build**: Ensure compile checks and esbuild package bundling compile without errors:
  ```bash
  npm run build
  ```
- [ ] **Check API Integration (Optional)**: If you updated the ESV or API.Bible parser schemas, run the integration suite to check for schema drift:
  ```bash
  npm run test:api
  ```

### 4. Post-Implementation Phase
- [ ] **Update ADR Records**: If your change introduces a new design pattern or structural library choice, append a new ADR block at the end of [.meta/architectural_decisions.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/architectural_decisions.md).
- [ ] **Update Overview**: If files were renamed or new entry points were added, update the map in [.meta/overview.md](file:///c:/Users/rayni/Documents/bible-sidecar-plus/.meta/overview.md).
