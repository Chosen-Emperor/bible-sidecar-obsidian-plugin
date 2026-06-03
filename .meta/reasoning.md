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
- **Dynamic Check**: Intercepted requests inside `navigateToPassage()`. If the view is offline, it reads local database translation caches and checks if the targeted chapter is cached.
- **User Notice Alert**: Shows an informative `new Notice()` warning that the chapter is unavailable offline, aborting navigation early to preserve active state.

## Scroll Position Memory Cache
- **Objective**: Retain scroll locations during navigation (e.g. going back from chapters to books) to prevent annoying layout jumps, resetting naturally on app restart.
- **In-Memory Cache Map**: Implemented `savedScrollPositions` inside the `BibleView` class. This holds view state positions at runtime without write-to-disk overhead.
- **Dynamic Save/Restore Triggers**: Integrated `saveCurrentScrollPosition()` on book card clicks, chapter button clicks, and back button navigations. Restores coordinates using `restoreScrollPosition()` via layout timeouts during rendering.
- **Smart Book Resets**: Deletes `chapters` scroll state when a new book is clicked so that users start scrolling from the top of the grid for a different book.






