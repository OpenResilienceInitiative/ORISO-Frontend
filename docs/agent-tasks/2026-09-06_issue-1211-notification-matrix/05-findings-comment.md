# #1211 — findings comment (to post on the issue)

Analysis done, matrix below. Two root causes, one fixed here, one that needs a
product decision. Backend items filed for their own PRs as the issue asks.

## Why nothing is "played"

Every notification kind defaults to `sound: 'none'`
(`notificationConfig.ts:76-91`), and `'none'` resolves to a null asset, which
returns before any audio is constructed (`soundPlayback.ts:62-65`, `:226-228`).
`call` is the only kind with a tone out of the box. So a new message, enquiry,
mention, handover or appointment plays nothing at all unless someone has gone
into settings and picked a tone by hand.

This is **not** the autoplay policy. The return happens before an `Audio` object
exists, so there is no `play()` for the browser to block. The unlock scaffolding
(`primeAudioPlayback`, `installAudioUnlock`) is present and correct — it is just
never reached for these kinds.

Whether the silence is intended is a product call — the comment above the `call`
row ("Calls keep ringing out of the box") reads as though it is — so I have not
changed it. If it should ring, the change is one line per kind.

## Why nothing is "delivered"

Separate bug, fixed in the PR. The browser-notification gate read the opt-in
from `localStorage.BROWSER_NOTIFICATIONS`, whose only writer is the legacy
panel. Which panel a user gets is decided by `enableNewNotifications`, and the
two are mutually exclusive (`profile.routes.ts:250-267`): with the toggle **on**
the legacy panel is not routed, so that key is never written, the gate reads
`enabled: false` forever, and no browser notification can be delivered no matter
what the user switches on or which permission they grant.

Confirmed in a signed-in session: `BROWSER_NOTIFICATIONS` was `null`.

## Matrix

Frontend behaviour per event, from the code. "Sound" is the out-of-the-box
default.

| Event                             | in-app timeline     | sound     | OS popup (before) | OS popup (after fix) | email              |
| --------------------------------- | ------------------- | --------- | ----------------- | -------------------- | ------------------ |
| New message                       | ✅ live             | ❌ `none` | ❌ never          | ✅ on opt-in         | ✅                 |
| Thread reply                      | ✅ live             | ❌ `none` | ❌ never          | ✅ on opt-in         | ❌                 |
| New enquiry                       | ⚠️ poll only (15 s) | ❌ `none` | ❌ never          | ✅ on opt-in         | ✅                 |
| New anonymous enquiry             | ✅ live             | ❌ `none` | ❌ never          | ✅ on opt-in         | ✅                 |
| Enquiry accepted                  | ⚠️ poll only        | ❌ `none` | ❌ never          | ✅ on opt-in         | ✅                 |
| Anonymous conversation finished   | ✅ live             | ❌ `none` | ❌ never          | ✅ on opt-in         | ❌                 |
| Handover (`case.handover.*`)      | ⚠️ poll only        | ❌ `none` | ❌ never          | ✅ on opt-in         | ❌                 |
| Supervisor added/assigned/removed | ⚠️ poll only        | ❌ `none` | ❌ never          | ✅ on opt-in         | ✅ SMTP            |
| Counsellor renamed                | ⚠️ poll only        | ❌ `none` | ❌ never          | ✅ on opt-in         | ❌                 |
| Call invite                       | ✅ live             | ✅ `ring` | ❌ never          | ✅ on opt-in         | ❌                 |
| `videoCallRequest`                | ❌ never emitted    | —         | —                 | —                    | —                  |
| Group invite                      | ❌ no path found    | —         | —                 | —                    | —                  |
| Appointment                       | ⚠️ poll only        | ❌ `none` | ❌ never          | ✅ on opt-in         | ⚠️ flag never read |

✅ works · ❌ does not fire · ⚠️ degraded

The ⚠️ rows are all the same cause: creating an `event_notification` row does not
push anything, so those events only surface on the frontend's 15-second poll.

## Backend items — each needs its own PR (ORISO-UserService)

1. **`event_notification` rows are never pushed.** `EventNotificationService.createEvent`
   only saves; the frontend polls `GET /users/event-notifications` every 15 s.
   That is every ⚠️ above.
2. **`videoCallRequest` / `videoCallDeny` are declared but never emitted.**
   `MatrixEventListenerService.java:677-682` logs "🔔 Triggering LiveService
   videoCallRequest event" and then `// TODO: Implement` plus a warn — the info
   line claims a trigger that does not happen.
3. **Wrong email template key.** `InactiveAccountNotificationService.java:34`
   uses `"free_text"`; the registered constant is `"free-text"`
   (`EmailSupplier.java:16`). The audit log records `emailDispatched(true)`
   either way.
4. **`notifications_enabled` defaults to off** (`NOT NULL DEFAULT '0'`,
   `0040_add_notification_settings`), back-filled to `1` only for rows that
   already had an email address.
5. **Sticky per-room mute.** `activeViewByUserId` is a per-JVM map cleared only
   by an explicit `PATCH .../active-view` with `active=false`. A closed tab
   leaves that user muted for that room indefinitely, on one replica only.

## Not yet done

The live column (job 2 — trigger each row on Pre-Dev with two accounts, record
in-app / sound / email) is not filled in; the matrix above is from the code. The
PR's reviewer test plan walks each row so it can be completed on Pre-Dev.
