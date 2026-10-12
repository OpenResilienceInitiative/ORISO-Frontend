# Problem brief

Source: https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1378#discussion_r4013059005

Replace five wall-clock sleeps in notification display-filter tests with controlled timers, preserving the assertions about retries and reconciliation.

Acceptance criteria:

- [x] All five sleeps use an act-wrapped fake-clock advance.
- [x] Tests use the provider debounce constant and restore real timers during cleanup.
- [ ] Targeted provider tests and relevant repository validation pass.
- [ ] Commit is pushed to the existing PR head branch.

Scope: timer tests and an exported debounce constant. Existing unrelated review findings are deferred. Preserve the dirty original checkout; use a worktree based on updated dev and fast-forwarded to the existing PR.
