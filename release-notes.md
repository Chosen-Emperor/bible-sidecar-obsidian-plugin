# Release Notes - v1.3.13

This release introduces major UI polish, parsing corrections, robust offline handling, and navigation UX improvements:

## Key Changes
1. **Core Parser Fixes**:
   * Resolved a critical issue where API.Bible translation texts under nested `.verse-span` structures were being extracted as blank. Added robust parent/sibling traversal to ensure 100% compliance across all 240+ translations.

2. **Scroll Snapping & Masking**:
   * Added in-memory scroll position caching for the book selector and chapter grid panels.
   * Restoring the scroll position uses instant snapping combined with temporary visual masking (opacity: 0) to hide screen jumps or visual flickers during navigation.

3. **Testament Collapse Memory**:
   * Added session persistence for Old Testament and New Testament header collapse/expand states.
   * Grids automatically expand during searches and seamlessly restore your preferred collapsed state when the search is cleared.

4. **Dynamic Offline Mode & Glow Accents**:
   * Added popup/popout-specific event listeners for online/offline changes to support multiple panels/windows.
   * Added dynamic offline status correction based on actual request success.
   * Added a premium hybrid visual state: cached books feature a subtle accent border glow when online, while online-only resources are dimmed when offline.

5. **Navigation & Double-Click Guards**:
   * Added direct back button navigation: `Verses -> Chapters -> Books`.
   * Added double-click guard controls to prevent duplicate async fetch requests when spamming click targets.
