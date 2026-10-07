# Confirm notification read and clear persistence

Scope: [Frontend issue 1665](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1665), under the [notification specification, issue 1211](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1211).

When a notification read or clear request failed, the activity feed still changed as if the server had saved it. Reloading could restore unread or apparently cleared activity. The provider now waits for the server acknowledgement before changing those rows and counts. Failed requests preserve activity and allow an explicit retry.

## Changes

- Explicit individual reads reuse existing confirmed-read serialization, duplicate protection, and reconciliation. Explicit retries bypass the automatic hidden-read cooldown.
- Read-all and clear requests retain the feed while pending, deduplicate repeated clicks, and preserve state on rejection. Polls and older pages are parked until the mutation settles.
- Successful clear invalidates older outstanding requests and reloads current server activity. Late mutation completions cannot alter a replacement auth session or issue reconciliation after unmount.
- Read-all preserves client-only activity created after the action began. Backend retention, notification preferences, native browser popups, and notification production are unchanged.

## Validation

Runtime: Node 22.12.0, matching the package requirement `>=22 <23`; Vitest 3.2.6. Dependencies were reused through a local `node_modules` symlink to an existing installed worktree; no dependency source or lockfile was modified.

For developers — deterministic regression command and measured results:

```text
node node_modules/vitest/vitest.mjs run --project unit --maxWorkers=2 --minWorkers=1 \
  src/globalState/provider/NotificationsProvider.test.tsx --reporter=dot

RED, before implementation: 5 failed / 26 passed (31 total).
Failures: pending individual read appears read; rejected individual read appears read;
no read-success reconciliation after a stale poll; pending read-all appears read;
pending clear removes the feed.

node node_modules/vitest/vitest.mjs run --project unit --maxWorkers=2 --minWorkers=1 \
  src/globalState/provider/NotificationsProvider.test.tsx \
  src/globalState/provider/NotificationsProvider.displayFilter.test.tsx \
  src/globalState/provider/NotificationsProvider.feedSignal.test.tsx --reporter=dot

Intermediate result: 2 failed / 52 passed (54 total).
Both existing display-filter tests returned unchanged mocked server state after a
successful mutation. Their server mocks now reflect persisted clear/read results;
the original state assertions remain intact.

Initial GREEN: 3 files passed / 59 tests passed.
Additional protection: acknowledged read state on remount; stale poll parking;
rejection followed by retry; auth-session replacement; unmounted completion;
new server and local activity during read-all; older-page completion during a
rejected clear. Existing announcement, display-filter, pagination, and Matrix
feed-signal tests also pass.

node node_modules/eslint/bin/eslint.js \
  src/globalState/provider/NotificationsProvider.tsx \
  src/globalState/provider/NotificationsProvider.test.tsx \
  src/globalState/provider/NotificationsProvider.displayFilter.test.tsx
Exit 0, no diagnostics.

Prettier formatted the three touched source/test files. git diff --check passed.
```

## Independent review corrections

The review identified direct account replacement without an intervening logout, and an individual read intent being dropped while read-all or clear was pending. Both received separate failing regressions before correction.

For developers — final correction evidence:

```text
Auth replacement RED: 5 failed / 38 passed (43 provider tests).
Auth correction GREEN: 43/43 provider tests.

Concurrent individual-read intent RED: 4 failed / 43 passed (47 provider tests).
Final GREEN: 3 suites / 71 tests passed, same targeted command above.

The existing parseJwt helper supplies sub + session_state (or sid) + tenantId
for feed isolation. Token refresh for the same principal/session does not reset
pending requests; opaque/incomplete tokens use exact-token fallback. No new JWT
parser or authentication mechanism was introduced.

Individual reads can run concurrently with bulk mutations. Existing pending
counts park feed responses, per-id tracking deduplicates requests, and successful
clear/session replacement invalidates old completions through the feed epoch.

Frozen source SHA-256:
23e7c8da66eb9f94c1b0f2673e5a351f6781aa00d20e81940e25f3d06d1c8117 NotificationsProvider.tsx
c574390ae9215f0688b030f3c2c28bc31892184b254584971f35b178c6baddfe NotificationsProvider.test.tsx
2ecee21c00f146b0966245b28423b90414fcc9fb8e512c37a38f461198db05a6 NotificationsProvider.displayFilter.test.tsx
```

## Remaining gates

Local targeted checks only. Full project gates, independent review, PR creation, CI, human merge, deployment, and real-browser reload acceptance are still required. No deployed environment was changed or tested by this slice.

## Final project gates and independent browser review

Frozen candidate provider SHA25623e7c8da66eb9f94c1b0f2673e5a351f6781aa00d20e81940e25f3d06d1c8117.

- Full unit suite:664files /11822tests passed,220.62seconds, exit0.
- Full lint:scripts (ESLint +TypeScript), lint:style and production build+hardcoded-host validation: exit0.
- Independent actual-component Chromium:30/30assertions, DE/EN, mobile390x844/tablet820x1180/desktop1440x900; no page errors.
- Independent source review:both initial findings corrected; no remaining actionable findings in touched scope.

Local synthetics only; CI, human merge, normal Dev deployment and full notification recipient acceptance remain open.
