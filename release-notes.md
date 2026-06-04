# Release Notes - v1.3.14

This release fixes study note indicators and hardens the annotation highlight system with a refactored state model and expanded test coverage.

## Bug Fixes

### Study Note Indicator Now Appears Immediately
- Fixed a critical bug in `showNotePrompt` where the 📝 note indicator would only appear after a *second* highlight action rather than immediately upon saving a note.
- **Root cause**: The NoteModal submit callback referenced an undefined variable (`verseEl` instead of `verseElOrEls`), causing the redraw call to silently fail via `.catch(() => {})`.
- **Fix**: Removed the erroneous `applyHighlight` call and replaced it with a direct `saveSettings()` → `applySavedHighlights()` flow — consistent with the rest of the annotation pipeline.

## Refactoring & Architecture

### Unified Annotation State Model
- Extracted annotation mutation logic from `BibleView.ts` into a pure `updateAnnotationsData()` function in `utils.ts`, making it independently testable.
- `applyHighlight` now acts as a clean state mutator: update data → save → full DOM repaint via `applySavedHighlights`. No more conflicting parallel DOM writes.
- Eliminated a double-write pattern in `showNotePrompt` that manually mutated `annotationsData` before calling `applyHighlight` (which would overwrite the same key a second time).

## Testing

### Expanded Unit Test Suite
- Added 19 unit tests in `run-tests.ts` covering highlight and note state mutations:
  - Adding/replacing/clearing highlights on single and range verses
  - Note preservation across highlight color changes
  - Array annotation handling (multi-phrase highlights)
  - Edge cases: empty notes, null colors, overlapping ranges

### API Compliance Tests
- Added `run-api-tests.ts` with 227 test cases validating verse fetch and parsing across API.Bible translations (run at release time via `npm run test:api`).
