# Architecture Decision Records (ADRs)

This document records the architectural and design decisions made for the **Bible Sidecar Plus** plugin to maintain stability and prevent regression during future development.

---

## ADR-001: Strict Separation of Concerns for Testability

### Status
Accepted

### Context
Testing Obsidian plugins is traditionally complex because the core API (`Plugin`, `ItemView`, `WorkspaceLeaf`, `Notice`) is tightly coupled to the Obsidian desktop wrapper application and Electron shell environment. Attempting to mock all Obsidian types inside test runners (such as Node.js or Jest) is fragile and leads to extensive code duplication.

### Decision
Extract all core algorithmic logic, regex patterns, parse matchers, file compilation helpers, and advanced search filters as **pure, exportable functions** inside [utils.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/utils.ts). 
These functions must never import from the `obsidian` module or depend on the browser-specific environment (`document`, `DOMParser`).

### Consequences
- Allows unit tests inside [run-tests.ts](file:///c:/Users/rayni/Documents/bible-sidecar-plus/run-tests.ts) to execute instantly inside a headless Node environment.
- Prevents the anti-pattern of copying production code replicas into the test runner to simulate behavior.

---

## ADR-002: Local-First Caching and On-Demand Offline Storage

### Status
Accepted

### Context
To support offline use cases and avoid rate-limiting or service outages on third-party remote endpoints, the plugin needs access to local database structures. However, copyright guidelines and API rate limits (e.g. Crossway ESV API limits calls to 60 requests/minute) prohibit bundling premium scripture in bulk inside the plugin installer.

### Decision
Implement a local JSON database cache structure inside `translations/[VERSION].json`.
1. **Public APIs (Bolls.life)**: Standard open translations can be downloaded in bulk during settings configuration using a queue with concurrent batches of 10 requests.
2. **Premium APIs (ESV / API.Bible)**: On-demand auto-caching is used. When a user browses chapters online, the retrieved premium content is written to the local translation JSON database immediately, making those chapters offline-accessible and indexable.

### Consequences
- Full-text search queries execute instantly on local data.
- Safe compliance with third-party rate limits and copyright distribution terms.

---

## ADR-003: Unified Painting Path for Highlights & Study Notes

### Status
Accepted

### Context
Early iterations painted highlights on the DOM inside click/selection callbacks, while notes sync and file saves triggered a separate reload. This led to state desynchronization (e.g. saving a study note on a selected phrase would clear the custom phrase styling wrapper and paint a generic full-verse backdrop overlay instead).

### Decision
Consolidate all DOM modifications for highlights, selections, notes, and cleans under a single paint entry point: `applySavedHighlights()`.
- Selection toolbar and annotation actions must modify the model (`this.settings.annotationsData`) first.
- Modifying the model triggers a save/sync call, clears the local DOM, and invokes `applySavedHighlights()` to repaint all highlights, phrase segments, note badges, and classes in one clean pass.

### Consequences
- Eliminates visual desynchronization bugs between highlights and notes.
- Provides a single source of truth for all formatting overlays.

---

## ADR-004: Obsidian Protocol Handler for Deep Linking

### Status
Accepted

### Context
Users wanted a way to click on a Bible reference inside their standard notes (e.g. `[[John 3:16]]`) and have it open the exact scripture chapter and verse in the sidebar view rather than opening a raw notes page.

### Decision
Register a custom protocol handler `obsidian://bible?...` inside `main.ts` with parameters for `book`, `chapter`, and `verse`. 
Clicking these links targets the `BibleView` pane, reveals the leaf, and invokes `navigateToPassage()` to retrieve content and scroll to the target coordinates.

### Consequences
- Integrates the plugin with the user's personal note-taking workspace.
- Requires references copied to the clipboard to format their links using this scheme (e.g. `[John 3:16](obsidian://bible?book=John&chapter=3&verse=16)`).

---

## ADR-005: Scroll Position Memory Cache

### Status
Accepted

### Context
When navigating between books, chapters, and verses, the viewport container would reset to the top. This caused disorienting layout jumps when backing out of a chapter view to return to the books menu.

### Decision
Maintain an in-memory runtime map `savedScrollPositions` inside the `BibleView` class tracking scroll offsets for the three views: `"books"`, `"chapters"`, and `"verses"`. Before rendering transitions, scroll heights are saved, and afterwards, they are restored via micro-timeouts that force a layout reflow.

### Consequences
- Layout rendering remains smooth and fluid.
- Storing scroll offsets in memory prevents disk write latency.

---

## ADR-006: Mobile Compatibility and Unicode Fallbacks

### Status
Accepted

### Context
Obsidian Mobile (iOS/iPadOS/Android) compiles SVG sprites differently from desktop, which frequently caused native Lucide icons loaded via `setIcon` to fail silently, rendering empty layout gaps.

### Decision
Introduce `safeSetIcon()` inside `BibleView.ts`. If `Platform.isMobile` is active, or if `setIcon()` fails to inject valid child paths, the method immediately falls back to touch-friendly, high-contrast Unicode emojis (e.g., 🔍 for search, ◀ for arrows, ▼/▲ for chevrons).

### Consequences
- Guaranteed layout stability on touchscreens and WebKit containers.
- Clean and consistent control layout across all platforms.

---

## ADR-007: Parallel View Responsive Collapse Threshold

### Status
Proposed (Pending User Confirmation)

### Context
The Bible sidecar panel can be resized to very narrow widths (< 300px) where a two-column parallel translation layout becomes unreadable. The feature must degrade gracefully without breaking the existing single-column view.

### Decision
Use a `ResizeObserver` on `.chapter-container` with a `480px` breakpoint. When the panel is wider than `480px`, render two `.chapter-column` divs inside a CSS grid `.parallel-container`. Below `480px`, collapse to a toggle-tab UI where only one translation is visible at a time.

### Consequences
- Parallel view never renders at an unreadable width.
- Mobile is always in toggle-tab mode (sidecar is always narrower than `480px` on phone screen sizes).

---

## ADR-008: Strong's Concordance is KJV-Only (Bolls.life Data Constraint)

### Status
Accepted

### Context
Strong's lexicon numbers (e.g., `God<H430>`) are embedded directly into verse text by the Bolls.life API for KJV and a small number of other translations. The ESV API and API.Bible do not include Strong's markup in their HTML responses. Implementing a generic parser that works across all three APIs is not feasible without a separate concordance data source.

### Decision
Restrict the Strong's Concordance feature to versions fetched from the Bolls.life API (specifically KJV). The `showStrongsNumbers` toggle in the settings UI will be visually disabled (greyed out with a tooltip) when an ESV or API.Bible version is active. No polyfill or workaround will be attempted for premium API sources.

### Consequences
- Feature scope is smaller than originally planned but correct and reliable.
- Prevents false-positive "no Strong's data" experiences for ESV users.

---

## ADR-009: Verse-Anchored Scroll Synchronization for Parallel View

### Status
Proposed (Pending User Confirmation)

### Context
Two scroll sync strategies were considered for the parallel translation view: (1) percentage-based (scroll % of A → same % in B) and (2) verse-anchored (find topmost visible `[data-verse]` in A → scroll B to same verse number). Percentage-based is simpler but fails when chapters have uneven verse-text distributions (e.g., Psalms with long and short verses side by side).

### Decision
Use verse-anchored synchronization via an `IntersectionObserver` mounted on all `[data-verse]` elements in column A. When the topmost visible verse changes, the observer callback scrolls column B to the matching `[data-verse]` element.

### Consequences
- Scroll sync is precise and verse-accurate regardless of text length differences.
- `IntersectionObserver` is well-supported in Electron (desktop) and WebKit (mobile).
- Slightly higher initial setup cost than percentage scrolling, but eliminates drift over long chapters.

---

## ADR-010: Strong's Concordance — Online-Only Definition Lookup with In-Memory Cache

### Status
Accepted (2026-06-04)

### Context
Bolls.life's KJV translation delivers verse text with Strong's markers inline (`God<H430>`). Rendering full lexical definitions requires a lookup service. Bundling a full Strongs dictionary offline would add several MB to the plugin download and is out of scope for the current release cycle.

### Decision
- `renderStrongsHtml()` (pure, in `utils.ts`) converts markers to `<span class="strongs-word" data-strongs="H430">` elements.
- On click, `renderStrongsPanel()` (in `BibleView.ts`) fetches the definition from the [BibleHub Strongs API](https://api.biblehub.com/strongs/hebrew/430) via Obsidian's `requestUrl`.
- Results are cached in a `Map<string, any>` (`strongsDefinitionCache`) on the view instance for the lifetime of the session, eliminating repeated network calls per word within the same session.
- If the network is unavailable, the panel shows a graceful error message without crashing.

### Consequences
- Requires internet for first definition fetch per word (consistent with ADR-008 philosophy).
- No vault-write side effects from Strong's lookup.
- Memory footprint is bounded: maximum ~1500 entries (total Strong's Hebrew + Greek lexicon), each entry < 1 KB.
