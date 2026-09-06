# #1211 — progress log

## 2026-09-06

**Enumerated** the notification-bearing events from both ends, as the issue's
job 1 asks and following Storypapst's steer to start at the UserService
`event_notification` subsystem rather than the frontend.

**Found two frontend root causes**, both read at source and both reproduced:

- **A — nothing has a sound but calls.** Every kind defaults to `sound: 'none'`,
  which resolves to a null asset and returns before any audio exists. Ruled the
  autoplay policy out as the cause: there is no `play()` to block.
- **B — the browser-notification opt-in was read from the wrong store.** The
  gate read `localStorage.BROWSER_NOTIFICATIONS`, written only by the legacy
  panel, which is not routed while `enableNewNotifications` is on. Confirmed in
  a live consultant session where that key was `null`.

**Fixed B.** Wrote the two failing tests first (`expected 1, got 0` — an opt-in
through the only reachable panel delivering nothing), then made the gate read
the settings store and made the legacy writer mirror into it so the old path
cannot regress after its one-time migration.

**Did not fix A.** The `call` row carries a comment ("Calls keep ringing out of
the box") that reads as though the silence elsewhere is intended, so changing
it is a product decision, not a defect fix. Filed with root cause per the
issue's acceptance ("fixed **or** filed with root cause and owner").

**Filed five backend items** for their own PRs, each verified directly in
ORISO-UserService rather than taken on trust — see
[05-findings-comment.md](05-findings-comment.md).

### Environment notes (not committed)

- The committed `.env` pointed `*_MATRIX_HOMESERVER_URL` at
  `matrix.oriso-dev.site`, which is CORS-blocked from localhost, so the Matrix
  client could not connect. `https://dev.oriso.org/_matrix/client/versions`
  answers 200 — Matrix is served from the same host as the API. Changed locally
  only; `.env` is gitignored.
- Notification permission was `denied` for localhost in the preview browser,
  which blocks any OS popup regardless of code.

### Not done

Job 2's live per-event run on Pre-Dev with two accounts. The matrix is derived
from code and labelled as such; the PR's reviewer test plan walks each row so
the observed column can be completed.
