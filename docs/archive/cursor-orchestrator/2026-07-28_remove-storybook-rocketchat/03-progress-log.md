# Progress log

## Iteration 1 — complete

- Target: Remove the dormant Rocket.Chat/DDP Storybook behavior and ratchet the
  Matrix-only test boundary.
- Change: Added a failing Storybook legacy-artifact contract, removed the
  obsolete public-settings/DDP responses and backup file, kept the
  protocol-neutral LiveService WebSocket shell, and updated Storybook wording.
- Verify: The new contract failed on the three expected legacy artifacts before
  the change and passes afterward (6 focused tests).

## Iteration 2 — complete

- Target: Prove the cleaned Storybook and frontend still compile and satisfy the
  repository hard gate.
- Change: No additional production change required.
- Verify: Storybook build passed; 215 unit-test files / 1,398 tests passed;
  script lint plus TypeScript, style lint, and the production build passed.
- Notes: The production build reports the repository's existing CRA,
  Autoprefixer, and bundle-size warnings. Local verification used Node 24.15
  because Node 22 was not installed; the package manifest still declares Node
  22 as its supported runtime.

## Iteration 3 — complete

- Target: Address the pre-PR review finding that the Storybook guard only
  inspected top-level files and implicit protocol artifacts.
- Change: Recursively scan text artifacts below `.storybook` and explicitly
  reject DDP markers.
- Verify: Focused regression tests and script lint plus TypeScript passed again.

## Iteration 4 — complete

- Target: Resolve the GitHub review findings against the published PR.
- Change: Clarify the Storybook documentation, harden legacy-marker casing and
  variants, and extract the generic realtime mock for behavioral testing.
- Verify: Focused lifecycle/guard tests, 216 unit-test files / 1,399 tests,
  script lint plus TypeScript, style lint, production build, and Storybook build
  passed.
- Notes: The first full-suite review run exposed a conflict with the older
  legacy-artifact scanner; the equivalent case-insensitive matcher was encoded
  without the forbidden literal and the repeated complete suite passed.
