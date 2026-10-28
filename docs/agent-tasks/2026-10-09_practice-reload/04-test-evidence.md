# Verification — local only
- RED: PracticeCards test before fix → 1 failed, 9 passed.
- Targeted unit after fix → 10 passed.
- npm run test:unit → 701 files, 12305 tests passed.
- npm run lint:scripts → pass (ESLint and TypeScript).
- npm run lint:style → pass.
- npm run build and postbuild deployment-host validation → pass.
- Vitest Storybook PracticeCards → 4 interaction and accessibility tests passed in Chromium.
- Chrome localhost:6011 CompletedAndInterrupted fixture → before showed In Bearbeitung despite fresh Start; after shows Nicht gestartet. Completed state remains Abgeschlossen.
- Screenshots: docs/storybook/issue-1679-practice-reload/01-before-interrupted.jpg and 02-after-interrupted.jpg.

These checks verify presentation and launch mode; they do not demonstrate live deployment or resumable practice state.
