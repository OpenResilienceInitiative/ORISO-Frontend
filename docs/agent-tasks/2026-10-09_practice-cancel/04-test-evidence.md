# #1680 validation

Environment: local Node 22 (`/opt/homebrew/opt/node@22/bin`), cloned worktree dependencies. No live deployment or backend verification.

| Command | Result |
| --- | --- |
| Initial focused red test | 3 expected failures: reset missing and earlier step write overtook reset |
| Final focused repository/banner tests | 27 passed |
| Real-shell practice/tour/logout integration | 57 passed |
| `npm run test:unit` (final source) | 701 files, 12,311 tests passed |
| `npm run lint:scripts` | Passed |
| `npm run lint:style` | Passed |
| `npm run build` | Passed; hardcoded-host validation passed |
| `npm run typecheck:storybook` | Passed |
| PracticeFlow Storybook Chromium, all stories | 5 passed, including cancellation interaction and a11y |

Final unit log: `/private/tmp/1680-unit-final.log`. Other logs: `/private/tmp/1680-final-targeted.log`, `/private/tmp/1680-integration.log`, `/private/tmp/1680-lint-scripts.log`, `/private/tmp/1680-lint-style.log`, `/private/tmp/1680-build.log`, `/private/tmp/1680-story-test-all.log`.

The first Storybook attempt failed before tests due to symlinked dependency imports. Cloning dependencies resolved it. An initial production build raced that dependency replacement and could not resolve JSX runtime; the clean subsequent build passed. A cancellation story initially reused a completion-only assertion; its helper was corrected and all five wired stories passed.

Before/after visual proof uses the same stateful tutorial-progress fixture. The baseline is a separate detached checkout containing the original End handler and the fixture only. Screenshots show the visible status after End; ordered writes, rejected-reset cleanup and login boundaries are proved by tests.

Chrome visual proof was captured from static Storybook builds because the dev optimizer hit an unrelated Emotion initialization error. The original End handler returns Help with “In Bearbeitung”; the fixed handler returns the same Help page with “Nicht gestartet”. The first static run encountered the shell's existing `visited` cookie initialization assertion; revisiting the fixed fixture after shell initialization completed without a new browser error. The clean Chromium test runner passed all five stories.
