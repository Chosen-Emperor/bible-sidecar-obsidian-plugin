# Reasoning - Highlight Refinements & User-Friendly Settings

This document records reasoning for the highlighting refinements and settings toggle behavior modifications.

## Design Philosophies
- **Clean Reading Experience**: Permanent Selection Underlines can be visually distracting and look cluttered during general reading. Restricting active styling to dynamic background animations ensures a clean layout.
- **Accurate Presentation of Premium Texts**: Verse highlighting must respect the premium layout structure of the ESV API (such as multiline block-quotes and stanzas).
- **Frictionless UI Controls**: Settings windows should not close expanded details blocks upon refreshing.

## Design Decisions
- **Persistent Underline Removal**: Removed the `border-bottom` underline from `.verse-inline.active-verse` in `styles.css`. Active verses now rely on temporary, fading amber background highlights.
- **Multi-Line Quote/Stanza Highlight**: Refactored the highlight logic in `navigateToPassage` (`BibleView.ts`) to query for all DOM elements matching the ESV API coordinate ID prefix (e.g., `[id^="p40015008"]` or `[id^="v40015008"]`). This highlights all lines of a poetic quote together, rather than just the first line.
- **Persist Details Element State**: Stored the toggled states `premiumDetailsOpen` and `autoExpandDetailsOpen` inside the `BibleSidecarSettingsTab` component. Listening to `toggle` events and restoring `open` attributes on re-render prevents details panels from collapsing when users click "Connect" or type input.
