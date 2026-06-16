# Reasoning - Selective Highlights & settings details panel open state persistence

This document tracks reasoning for highlight refinements (nested vs double highlighting) and settings details state persistence.

## Design Philosophies
- **Clean and Accurate Highlights**: Visual highlights should target exactly and only the text matching the specified verse number. In nested structures, children of different verses must not be colored, and double background overlays must be avoided.

## Design Decisions
- **Filter Out Different Nested Verses (Rule 1)**: In `navigateToPassage` (`BibleView.ts`), if a coordinate-matched element contains a descendant that belongs to a different verse (due to browser DOM auto-nesting on unclosed spans in Crossway's HTML), we skip highlighting that parent. Instead, we recursively target its immediate child nodes and highlight only those that do not belong to the different verse.
- **Prevent Double Highlights (Rule 2)**: If an element is a descendant of another element already highlighted as active for the same verse, we skip applying `.active-verse` to it to prevent overlapping background overlays.

## Robust DOM Traversal for Nested API.Bible Structures
- **Problem**: API.Bible wraps verse numbers in a `<span class="verse-span">` container (e.g. `<span class="verse-span" data-verse-id="JHN.3.1"><span class="v" data-number="1">1</span></span><span class="verse-span" data-verse-id="JHN.3.1">Now there was...</span>`). Using `span.nextSibling` directly on `span.v` results in `null` because the inner span has no siblings inside its parent, leading to empty verse texts.
- **Solution (Traversal Fallback)**: If `span.nextSibling` is `null` and its parent has the class `verse-span`, the parser falls back to the parent's next sibling (`span.parentElement.nextSibling`).
- **Solution (Termination Check)**: The parser checks if any sibling node or its descendants contains the verse number class (using `next.querySelector("." + verseClass)`) to prevent overflowing into the text of the next verse.

## Offline Optimization & Download Indicator Accents
- **Objective**: Improve offline performance and provide high-fidelity visual indication of cached books and chapters.
- **Instant Offline Bypassing**: Implemented strict early returns when `isOfflineState` is true inside `generateBibleBooks` and `getChapterContent`. This stops DNS/TCP timeouts when offline, leading to instant rendering.
- **Accents Settings Toggle**: Added `enableOfflineAccents` toggle to options, letting users disable visual progress indicator styles completely.
- **Card Bottom Progress Border**: For book buttons, turned the bottom border into a visual progress bar indicating the exact proportion of downloaded chapters (`--download-proportion`).
- **Higher Contrast Chapters**: Strengthened contrast and glow opacity on cached chapters to make them less subtle.

## Collapsible Testament Accordions
- **Objective**: Improve vertical space efficiency on mobile layouts, allowing users to quickly hide the Old Testament to access the New Testament.
- **Accordion Toggle Toggling**: Clicking a testament header collapses/expands the corresponding books grid with visual chevron states.
- **Search Auto-Expansion**: Searching automatically expands grids containing matches so that matching books are immediately visible.

## Interactive Top-Right Outage Button
- **Objective**: Replace bulky inline banners with a modern, compact, top-right absolute-positioned indicator.
- **Dynamic Insertion**: Created `bible-offline-indicator-btn` inside `updateOfflineStatus()`, targeting the parent `.bible-wrapper` element to avoid code duplication across views.
- **Active Network Probe**: Added `probeConnection()` helper performing an ultra-fast `HEAD` request to `https://1.1.1.1` to confirm WAN connection on click.
- **Immediate Refresh**: Successful connection checks immediately update connection state and refresh/reload the active books/chapters grid without requiring a vault reload.
- **Inline Slot Layout (Overlapping Fix)**: Discarded absolute positioning in favor of pre-allocated flex layout slots (`.bible-header-right-slot` and `.bible-tabs-right-slot`) to keep the outage icon inline, ensuring it never overlaps search controls or back/navigation buttons.

## Offline Passage Navigation Guard
- **Objective**: Prevent users from navigating to blank/broken screens when clicking on internal links (`[[John 3:16]]` etc.) directed at uncached scriptures.
- **Dynamic Check**: Intercepted requests inside `navigateToPassage()`. If the view is offline, it reads local Offline Cache files and checks if the targeted chapter is cached.
- **User Notice Alert**: Shows an informative `new Notice()` warning that the chapter is unavailable offline, aborting navigation early to preserve active state.

## Scroll Position Memory Cache
- **Objective**: Retain scroll locations during navigation (e.g. going back from chapters to books) to prevent annoying layout jumps, resetting naturally on app restart.
- **In-Memory Cache Map**: Implemented `savedScrollPositions` inside the `BibleView` class. This holds view state positions at runtime without write-to-disk overhead.
- **Dynamic Save/Restore Triggers**: Integrated `saveCurrentScrollPosition()` on book card clicks, chapter button clicks, and back button navigations. Restores coordinates using `restoreScrollPosition()` via layout timeouts during rendering.
- **Smart Book Resets**: Deletes `chapters` scroll state when a new book is clicked so that users start scrolling from the top of the grid for a different book.

## Advanced Search Operators
- **Objective**: Expand keyword search with exact phrases, negative exclusions, and book/testament scopes.
- **Parsing Structure**: Implemented `parseAdvancedSearchQuery` inside `utils.ts`. It parses `""` patterns for exact phrases, `-` prefix for exclusions, and `:` / book names for scope limits.
- **Matcher Logic**: Introduced pure `matchesSearchQuery` check validating every criteria against verse texts, returning results instantly without UI overhead.
- **Robust Book Name Matching**: Removed direct reliance on array indexing (`BIBLE_BOOK_IDS[bookid - 1]`) in the search matcher which fails in bibles containing Apocrypha books due to book index shifts. Modified the check to compare book name prefixes, resolved 3-letter codes, and full uppercase matches.
- **Search Operator Guide**: Added `renderSearchHelpGuide` rendering a structured syntax overview card when no query is typed in the Search view.
- **Clear Button Position & Style Fix**: Centered the absolute `.bible-search-clear` element vertically using `top: 50%` and `transform: translateY(-50%)` with explicit dimensional bounds to correct sizing alignment issues.

## Custom Highlighter & Annotations Sync
- **Objective**: Let users highlight verses in multiple colors (yellow, green, blue, pink) and attach notes, with full data ownership via local vault synchronization.
- **Floating Toolbar & Event Delegation**: Added `showHighlightToolbar`, `applyHighlight`, and `showNotePrompt` in `BibleView.ts`. Used click event delegation on the `.chapter-content` container to handle all layout types cleanly.
- **Vault Note Synchronization**: Implemented `syncAnnotationsToVault` inside `main.ts`. It parses `annotationsData` and translates it into a structured Markdown file (e.g. `bible-annotations.md`) grouped by Bible book, keeping data human-readable and indexable.
- **Styling Overlay**: Implemented glassmorphic circles and color dot actions in `styles.css`.

## Selective Phrase-Level & Multi-Verse Highlighting
- **Objective**: Allow users to highlight specific selected phrases (rather than just entire verses) and support selections spanning multiple verses.
- **TreeWalker Text Splitting**: Implemented `highlightPhraseInElement` inside `BibleView.ts` which uses a DOM `TreeWalker` to traverse and cleanly split text nodes inside verse elements. This applies `.highlight-phrase` spans directly to the selected characters without breaking HTML wrappers/nested elements.
- **Multi-Verse Range Grouping**: Updated event handling to group selections covering multiple verses under a single range key (e.g. `John 3:16-17`) in `annotationsData`. This stores a map of verse-to-phrase mappings, preventing duplicate list items in the saved file.
- **Sidecar Deep Links**: Configured `syncAnnotationsToVault` to output clickable links using the `obsidian://bible` scheme, enabling navigation directly back to the exact passage in the sidecar view when clicked in the Markdown file.
- **Obsidian Native NoteModal**: Replaced the native browser `prompt()` dialog (which fails silently or is blocked in Electron/Obsidian) with an Obsidian-native `NoteModal` class using `Modal` and `Setting` APIs, providing a premium, multi-line notes editor.
- **Note Preservation on Highlight Updates**: Resolved a bug in `applyHighlight` where saving settings or modifying highlighting color/phrase selection overwrote the annotation object with `{ color }` or `{ color, text, verses }`, discarding the `note` attribute. Structured `applyHighlight` to read and merge any `existingNote` during highlights compilation.

## Highlight Refinements (Scroll Sync, Diagnostics, Overlapping Clears)
- **Settings Save Scroll Memory**: Every highlight update triggers a settings save and full view refresh. Cached and restored container scroll offsets in `updateSettings` to prevent viewport jumps during highlighting.
- **Verbose Phrase-Matching Diagnostics**: Added raw text nodes, normalized whitespaces, and exact-vs-normalized index search results logging in `highlightPhraseInElement` to debug text segment alignment failures in layout-rich poetry and dialog scripture passages.
- **Overlapping Highlight Clearing**: Configured clearing highlight (null color) to search and delete any overlapping single or range keys in settings, cleaning their highlight classes and note badges from the active DOM.
- **Split Verse Phrase Arrays**: Allowed the `verses` sub-key in annotations data to store both strings and arrays of strings (`string | string[]`). This prevents split element selections (e.g. multi-line poetry in Song of Solomon 1:5) from overwriting each other, allowing every split DOM segment of the verse to highlight its correct selected text portion.
- **Double Highlighting Prevention**: Configured `highlightPhraseInElement` to strip out full-verse class definitions (e.g., `highlight-yellow`, etc.) from a verse element once a specific phrase highlight has successfully matched inside it, resolving layout conflicts and color mixing.
## Refactored Highlighting & Notes Sync Architecture
- **Objective**: Simplify visual highlight and study note state updates, eliminating duplicate painting logic, desynchronization on saving notes, and complex DOM manipulation branching.
- **Unified Painting via applySavedHighlights**: Refactored `applyHighlight` to act as a state-mutator and event-dispatcher. It updates `this.settings.annotationsData` and saves settings, clears existing formatting from affected DOM elements, and then cleanly repaints the DOM using the centralized `applySavedHighlights()` method.
- **Result**: Visual phrase-level selections, multi-verse highlights, note indicators, and overlapping cleans are completely unified in a single paint path. This resolves the desynchronization bug where saving a study note on a phrase highlight would inadvertently clear the phrase highlight markup and render a full-verse backdrop instead.
