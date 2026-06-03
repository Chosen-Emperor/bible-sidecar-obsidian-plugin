# Reasoning - Click Highlighting Removal & Settings API Validation

This document tracks design reasoning for two major changes: the premium settings feedback and the removal of click-based sidecar verse highlights.

## Design Philosophies
- **Minimalist & Clean Layout**: Standardizing on automatic and snappier temporary highlights when navigating to a passage (for search and cross-referencing), rather than adding permanent active verse states upon simple sidecar click events, which could lead to unwanted visual clutter.

## Design Decisions
- **Removing chapterContent Click Listener**: Removed the click event listener that matched nearest `.verse`, `.verse-inline`, or `.verse-num` elements and applied `.active-verse`. This prevents permanent selection highlights during normal reading clicks.
- **Dynamic Settings API Validation**: Retained the live checking of ESV and API.Bible keys via on-demand HTTP requests and updating setting description labels.
