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

## Review round 1 — changes requested (Shazia)

Two findings, both confirmed in code before touching anything.

**1. The call-site gates still decided.** `WebsocketHandler.tsx:143-145` read
`!enableNewNotifications || isBrowserNotificationTypeEnabled('newMessage')`, so
with the toggle ON the legacy localStorage check became the deciding operand and
the call never happened. `useBrowserNotification.ts:26-28` gated enquiries the
same way with no toggle check at all. My unit tests passed because they called
`sendNotification` directly and never went through either gate.

Fix: both gates deleted. `sendNotification` makes the whole decision, scoped to
whichever panel the release toggle actually routes — the legacy per-browser key
while the old panel is rendered, the settings store once the cross-device panel
is. The per-type distinction survives in both worlds: legacy
`newMessage`/`initialEnquiry`, and the harmonised banner rows
(`conversations.standard`, `requests.new`) respectively.

**2. Regression for accounts seeded before this PR.** `attachClient` only
migrated the legacy opt-in when the account had no settings event at all, so an
account seeded from another device carried `enabled: false` and silently
overrode a legacy "on".

Fix: a one-time, one-way reconcile in `attachClient` — it only ever turns the
flag ON, and a per-browser marker (`ORISO_NOTIFICATION_LEGACY_MIGRATED`) means a
later deliberate "off" in the new panel is never undone.

**Tests now run through the call sites, not around them.** Verified by stashing
the source fix and re-running: `WebsocketHandler.notifications.test.tsx` fails
with `expected [] to have a length of 1` on the pre-fix code — the exact
symptom from the issue. It also caught a second regression the first round
introduced: with the toggle OFF the legacy `newMessage` switch had stopped
being honoured.

- `src/components/app/WebsocketHandler.notifications.test.tsx` (6)
- `src/hooks/useBrowserNotification.test.tsx` (5)
- `notificationHelpers.test.ts` (15) and `notificationSettings.test.ts` (20)

`npm run lint:scripts` clean. Full unit run: 4059 passed, the same 5 failures
that reproduce on this branch with every change stashed (noCaritasLegacy ×2,
AnimatedIllustration lottie guard, callTheme artefact, legacyAppointmentProvider).
