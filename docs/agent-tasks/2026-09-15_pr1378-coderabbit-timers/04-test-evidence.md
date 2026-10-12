# Test evidence

Environment: local Windows, Node v22.23.2, dependencies reused through a worktree junction. No live deployment or UI behavior changed.

- Targeted provider files: `node node_modules/vitest/vitest.mjs run --project unit src/globalState/provider/NotificationsProvider.displayFilter.test.tsx src/globalState/provider/NotificationsProvider.test.tsx --maxWorkers=1 --minWorkers=1` -> 17 passed.
- Independent verifier: display-filter file -> 11 passed after final cleanup change, no new actionable findings.
- `npm run lint:scripts` -> passed, including TypeScript.
- `npm run lint:style` -> passed.
- `git diff --check` -> passed.
- `npm run build` -> production bundle compiled with existing warnings; npm postbuild could not find bash on Windows. Equivalent postbuild run with `C:/Program Files/Git/bin/bash.exe scripts/validate-hardcoded-hosts.sh build` -> passed.
- `npm run test:unit` -> incomplete: 292 passing files and 4 failing files before several minutes without output. Both test workers were terminated; no full-suite pass claimed. Both provider files passed within this run.
- Original-checkout baseline for the four failed files -> 166 tests passed, 3 failed. The call-theme generated-file comparison and both legacy guards reproduced before this change. Theme-token inventory passed on original checkout but failed on PR; this timer diff contains no theme-token changes.

Residual risks: three earlier review findings remain outside the CodeRabbit timer request (pending account-data echo overwrites, active-chip reconciliation, and excluded-total decrements). This patch does not claim to resolve them.

Follow-up: rerunning all four failed files separately on the PR checkout produced the same result as the original checkout: 166 passed, 3 failed. The theme-token inventory passed on this rerun. Its broad-run failure did not reproduce; the three persistent failures are pre-existing. Full suite remains incomplete.

Remote integration: during validation, 28b1ca7b was pushed to the PR. The timer commit was rebased onto it normally. Its new epoch-reset test now awaits the controlled PATCH promise inside act instead of sleeping 50ms. Final combined verification: both provider files and store tests -> 37 passed (12 display-filter, 6 provider, 19 store). Earlier residual-risk notes describe inspection at 7db27676, before the separate remote review-fix commit; they are not a verdict on 28b1ca7b.

Final integration: rebased onto concurrent PR commit 45e8b0ed. Converted its five additional sleeps to fake-clock advances or controlled promise settlement. Final targeted run: 42 passed (16 display-filter, 6 provider, 20 store). Touched-file ESLint and TypeScript passed after this rebase. Earlier full lint/style/build results predate these remote commits; no final full-suite pass is claimed.
