# Progress

### Iteration 1 — pass

- Target: remove the duplicate create-chat card while retaining toolbar creation.
- Evidence: real-browser play check failed on `.createChatItem` in the original
  composition, then passed after the unused card/source/story/styles were removed.
- Verify: focused `SessionListColumn` story, 1 passed, 4 deselected.
- Retired password stories were removed as explicitly requested; the active
  reset-email route was preserved. No equivalent redesigned recovery dialog was
  found; a reporter reference remains open.

### Iteration 2 — pass for layout; accessibility gate remains open

- Target: desktop vertical navigation and full-width mobile navigation.
- Evidence: new mobile geometry check failed with 85px navigation against a
  375px viewport. Shared required app scope and responsive composition fix it.
- Independent review found global story style selectors could collide in Docs;
  inline per-instance CSS variables now prevent that collision. The independent
  reviewer rechecked the correction and returned COVERED.
- Accessibility/fixture failures also occur on the original navigation stories;
  no audit suppression or live API workaround is part of this change.

### Repository checks

- Full unit suite: 838 files / 14,523 tests passed; 1 file / 8 tests skipped.
- Script lint including TypeScript: passed.
- Style lint: passed.
- App build and deployment-host guard: passed, existing build warnings retained.
- Storybook typecheck: passed.
- Local Storybook index: retired entries absent; retained creation/navigation
  story IDs and linked canonical variants present.

Full icon and unused-story inventory is in `icon-and-legacy-audit.md`.
