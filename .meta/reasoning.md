# Reasoning - Selective Highlights & settings details panel open state persistence

This document tracks reasoning for highlight refinements (nested vs double highlighting) and settings details state persistence.

## Design Philosophies
- **Clean and Accurate Highlights**: Visual highlights should target exactly and only the text matching the specified verse number. In nested structures, children of different verses must not be colored, and double background overlays must be avoided.

## Design Decisions
- **Filter Out Different Nested Verses (Rule 1)**: In `navigateToPassage` (`BibleView.ts`), if a coordinate-matched element contains a descendant that belongs to a different verse (due to browser DOM auto-nesting on unclosed spans in Crossway's HTML), we skip highlighting that parent. Instead, we recursively target its immediate child nodes and highlight only those that do not belong to the different verse.
- **Prevent Double Highlights (Rule 2)**: If an element is a descendant of another element already highlighted as active for the same verse, we skip applying `.active-verse` to it to prevent overlapping background overlays.
