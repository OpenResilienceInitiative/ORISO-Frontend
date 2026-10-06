# #1211 — Event matrix and root causes

All file:line references were read directly; the two frontend root causes are
also reproduced as failing tests (see [04-test-evidence.md](04-test-evidence.md)).

## Root cause A — no notification kind has a sound, except calls

`notificationConfig.ts:76-91` builds every kind from one factory:

```ts
const kind = (partial: Partial<KindConfig> = {}): KindConfig => ({
	banner: 'temporary',
	sound: 'none', // ← every kind
	email: true,
	volume: DEFAULT_VOLUME,
	...partial
});

const areaDefaults = () => ({
	new: kind(),
	standard: kind(),
	mention: kind({ email: false }),
	handover: kind(),
	call: kind({ sound: 'ring', email: false }), // ← the only override
	appointment: kind()
});
```

`soundPlayback.ts:62-65` maps `'none'` to `null`, and `:226-228` returns on a
null asset:

```ts
const asset = soundAssetFor(kindConfig.sound);
if (!asset || !('Audio' in window)) {
	return;
}
```

So out of the box a new message, new enquiry, mention, handover or appointment
plays nothing at all. Only a call rings. This is the literal complaint in the
report title.

**Not the autoplay policy.** The return happens before any `Audio` is
constructed, so there is no `play()` for a policy to block. Autoplay handling
(`primeAudioPlayback`, `installAudioUnlock`, `soundPlayback.ts:158-172`) is
present and correct; it is simply never reached for these kinds.

**Deliberate or not is a product question.** The comment above the `call` row
("Calls keep ringing out of the box") reads as though the silence elsewhere is
intended. Changing it is a product decision, so this PR does not change it —
it is reported here for the issue to decide.

## Root cause B — the browser-notification opt-in was read from the wrong place

_Fixed in this PR._

`notificationHelpers.ts` gated on the legacy per-browser key:

```ts
if (
	!isSupported() ||
	!hasPermissions(PERMISSION_GRANTED) ||
	!browserNotificationsSettings().enabled
) {
	return;
}
```

`browserNotificationsSettings()` reads `localStorage.BROWSER_NOTIFICATIONS`,
defaulting to `{"enabled": false}` (`:167-170`). The only writer of that key is
the legacy panel, `profile/BrowserNotifications/index.tsx`.

Which panel a user gets is decided by a release toggle
(`profile.routes.ts:250-267`) and the two are mutually exclusive:

| `enableNewNotifications` | panel shown                                       | writes                                   |
| ------------------------ | ------------------------------------------------- | ---------------------------------------- |
| off                      | `BrowserNotifications` (legacy, consultants only) | `localStorage.BROWSER_NOTIFICATIONS`     |
| **on**                   | `NotificationSettingsPanel` (all roles)           | the settings store (Matrix account data) |

With the toggle **on**, the legacy panel is not routed at all, so the key is
never written, the gate reads `enabled: false` forever, and **no browser
notification can ever be delivered** — whatever the user switches on and
whatever permission they grant.

Confirmed live in a signed-in consultant session: `BROWSER_NOTIFICATIONS` was
`null` while the store held `browserNotifications.enabled` from the new panel.

The store's migration (`store.ts:175-185`) only runs legacy → store, once, for
an account with no settings event yet — so it does not rescue this either.

### The fix

1. The gate reads the settings store, which both panels feed.
2. `saveBrowserNotificationsSettings` mirrors legacy writes into the store, so
   the legacy path cannot regress after that one-time migration.

## The matrix

Frontend behaviour per event, from the code. "Sound" is the out-of-the-box
default; every row except `call` can be given a tone by hand in settings.

| Event                                          | in-app timeline                   | sound (default) | OS popup (before fix) | OS popup (after fix) | email                                |
| ---------------------------------------------- | --------------------------------- | --------------- | --------------------- | -------------------- | ------------------------------------ |
| New message (Matrix / `directMessage`)         | ✅ live via STOMP + Matrix bridge | ❌ `none`       | ❌ never              | ✅ on opt-in         | ✅ `message-notification-*`          |
| Thread reply                                   | ✅ live                           | ❌ `none`       | ❌ never              | ✅ on opt-in         | ❌ none wired                        |
| New enquiry (`request.new`)                    | ⚠️ poll only (15 s)               | ❌ `none`       | ❌ never              | ✅ on opt-in         | ✅ `enquiry-notification-consultant` |
| New anonymous enquiry                          | ✅ live (`newAnonymousEnquiry`)   | ❌ `none`       | ❌ never              | ✅ on opt-in         | ✅                                   |
| Enquiry accepted (`inquiry.accepted`)          | ⚠️ poll only                      | ❌ `none`       | ❌ never              | ✅ on opt-in         | ✅ `free-text`                       |
| Waiting-room / anonymous conversation finished | ✅ live                           | ❌ `none`       | ❌ never              | ✅ on opt-in         | ❌                                   |
| Handover (`case.handover.*`)                   | ⚠️ poll only                      | ❌ `none`       | ❌ never              | ✅ on opt-in         | ❌ none wired                        |
| Supervisor added/assigned/removed              | ⚠️ poll only                      | ❌ `none`       | ❌ never              | ✅ on opt-in         | ✅ direct SMTP (tenant-gated)        |
| Counsellor renamed                             | ⚠️ poll only                      | ❌ `none`       | ❌ never              | ✅ on opt-in         | ❌                                   |
| Call invite                                    | ✅ live via Matrix                | ✅ **`ring`**   | ❌ never              | ✅ on opt-in         | ❌                                   |
| `videoCallRequest` live event                  | ❌ **never emitted**              | —               | —                     | —                    | —                                    |
| Group invite                                   | ❌ no notification path found     | —               | —                     | —                    | —                                    |
| Appointment                                    | ⚠️ poll only                      | ❌ `none`       | ❌ never              | ✅ on opt-in         | ⚠️ flag never read                   |

Legend: ✅ works · ❌ does not fire · ⚠️ works but degraded.

## Backend findings (ORISO-UserService — separate PRs)

Each verified directly in that repo.

1. **`event_notification` rows are never pushed.** `EventNotificationService.createEvent`
   only saves to the repository; the frontend must poll `GET /users/event-notifications`
   (15 s interval, `NotificationsProvider.tsx:381`). So `request.new`,
   `inquiry.accepted`, `supervisor.*`, `counselor.renamed` and all three
   `case.handover.*` events have no realtime delivery. This is the ⚠️ in the
   matrix.
2. **`videoCallRequest` / `videoCallDeny` are declared but never emitted.**
   `MatrixEventListenerService.java:677-682` logs "🔔 Triggering LiveService
   videoCallRequest event" and then `// TODO: Implement` + a warn. The info line
   claims a trigger that does not happen.
3. **Wrong email template key.** `InactiveAccountNotificationService.java:34`
   uses `"free_text"`; the registered constant is `"free-text"`
   (`EmailSupplier.java:16`). The audit log records `emailDispatched(true)`
   regardless.
4. **`notifications_enabled` defaults to off.**
   `0040_add_notification_settings/add-notification-settings.sql:2,13` —
   `NOT NULL DEFAULT '0'`, back-filled to `1` only for rows that already had an
   email address.
5. **Sticky per-room mute.** `EventNotificationService` keeps `activeViewByUserId`
   in a per-JVM `ConcurrentHashMap`, cleared only by an explicit
   `PATCH .../active-view` with `active=false`. A closed tab or lost request
   leaves that user muted for that room indefinitely, and only on one replica.
