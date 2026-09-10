# Call timeline and database-backed scheduling handoff

Prepared: 2026-09-10

Frontend branch: `fix/call-lifecycle-complete`

Target branch for later developer integration: `dev`

UI implementation commits: `61e23dd5`, `0a0b9b91`

Related UserService branch: `fix/call-lifecycle-notifications-730` at `0d55865b`

## Problem and delivered behavior

Call and appointment events previously lacked one consistent sender-aware system-message model. Calendar actions also used a locally assembled MUI menu, the event avatar could overlap or clip the card, and the runtime title repeated a generated sentence instead of identifying the initiator.

The Frontend branch now provides permanent Storybook approval surfaces and application rendering for:

- sent and received call events;
- audio and video calls;
- scheduled, running, ended, and missed call states;
- current members while a call is running and the final attendance snapshot after it ends;
- appointment requested, scheduled, accepted, and declined states;
- the four supplied semantic scheduling icons;
- 48 px call or scheduling symbols inside the canonical 60 px event frame;
- an initiator-only title and a separate action summary;
- sender-aware card color, avatar placement, overflow menu placement, and CTA alignment;
- call-type icons inside the join/start CTA;
- the shared `ChatMenuDropdown` and Material 3 `SplitButton` for ICS, Google Calendar, and Outlook, including its open Elevated state.

The latest dictated alignment rule is implemented: a received event places its CTA on the right; an event sent by the current user places its CTA on the left.

Identity semantics are explicit:

- appointment and call events name the authenticated human initiator;
- `requested`, `scheduled`, `accepted`, and `declined` are shown as `Terminanfrage`, `Termin geplant`, `Termin bestätigt`, and `Termin abgelehnt`;
- `Carimat` is reserved for events actually emitted by the platform assistant;
- the assistant's visible name belongs to global platform configuration in the Admin Panel and must never be copied into appointment fixtures or used as a human sender placeholder.

Permanent Storybook stories:

- `Chat/Call event in the timeline/Alle vier Zustände`
- `Chat/Call event in the timeline/Video und Audio · Mitglieder live und danach`
- `Chat/Call event in the timeline/Geplant · mit Kalender-Menü`
- `Chat/Scheduling system events/Alle Zustände · Ich und andere`
- `Chat/Scheduling system events/Mobil`

## Existing runtime boundary

`MessageItemComponent` already consumes `CallLifecycleMessage`. A scheduled call can render a calendar action when its event contains `scheduled_for`, but the current creation flow does not provide a stable identifier that connects one scheduled occurrence with the `callId` created later by `CallManager.startCall`. `CallManager` currently creates a random ID when the call starts. Group-chat creation responses expose a `matrixRoomId`, not an occurrence ID plus call ID.

The UserService branch persists lifecycle rows by `(matrix_room_id, call_id)` and can project MatrixRTC attendance. It cannot infer which future appointment or group-chat occurrence should own a newly generated call ID without an explicit contract.

## Required database-backed scheduling package

### 1. Canonical occurrence record

Add one tenant-scoped durable call occurrence owned by the service that already owns the relevant scheduled chat or appointment. Reuse an existing appointment or group-chat occurrence entity only if it can preserve the contract below without ambiguous joins.

Minimum fields:

| Field | Requirement |
| --- | --- |
| `id` | UUID, stable occurrence identifier |
| `tenant_id` | Required tenant boundary |
| `conversation_room_id` | Matrix room in whose timeline the event appears |
| `call_room_id` | Nullable until a dedicated call room exists |
| `call_id` | Stable at schedule creation; never regenerated when the call starts |
| `call_type` | `AUDIO` or `VIDEO` |
| `status` | `REQUESTED`, `SCHEDULED`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `RUNNING`, `ENDED`, `MISSED` |
| `scheduled_start` | UTC instant |
| `timezone` | IANA zone used when the organiser entered the time |
| `duration_minutes` | Positive integer |
| `initiator_user_id` | Authenticated sender |
| `recipient_user_ids` | Explicit recipients or relation table |
| `created_at`, `updated_at`, `version` | Audit and optimistic locking |

Use foreign keys where the owner service has authoritative local entities. Apply tenant predicates to every lookup and mutation. Do not put private appointment text into calendar URLs or idempotency keys.

### 2. API contract

Provide authenticated operations for:

1. create a request or scheduled occurrence;
2. accept or decline a request;
3. reschedule an accepted or scheduled occurrence;
4. cancel an occurrence;
5. read an occurrence by ID in the context of its conversation;
6. bind or create the dedicated call room without changing `call_id`;
7. transition to running, ended, or missed idempotently.

Every mutation must accept an idempotency key. Duplicate retries must return the same occurrence and must not duplicate Matrix events, Activity Center entries, email, or push notifications. Reject illegal transitions with a stable error code and the current server state.

The create response must include at least:

```json
{
  "scheduleId": "uuid",
  "callId": "stable-call-id",
  "conversationRoomId": "!room:server",
  "callRoomId": null,
  "callType": "VIDEO",
  "status": "SCHEDULED",
  "scheduledStart": "2026-09-10T16:00:00Z",
  "timezone": "Europe/Berlin",
  "durationMinutes": 60,
  "initiatorUserId": "@user:server"
}
```

### 3. Matrix and Frontend integration

- Emit one timeline event containing `schedule_id`, `call_id`, `call_type`, `scheduled_for`, `duration_seconds`, initiator, and the authoritative status.
- Use `m.replace` or the existing lifecycle replacement contract so the same logical entry progresses through its states.
- Pass the persisted `callId` into `CallManager.startCall`; remove random ID creation for scheduled occurrences.
- Keep spontaneous calls working by creating their occurrence immediately before the call starts.
- After reload or on a second device, reconstruct the same event from service and Matrix state.
- Keep the current Element Call join path and the dedicated call-room mapping.

### 4. Notifications and languages

Produce Activity Center, email, and push notifications for the transitions that require user attention:

- request created;
- request accepted;
- request declined;
- scheduled or rescheduled;
- cancelled;
- reminder;
- missed call.

Apply tenant SMTP configuration, user notification preferences, appointment preferences, Do Not Disturb, actor exclusion, and idempotent delivery keys. The Frontend email catalogue covers `de`, `de@informal`, `en`, `fr`, `ru`, `ti`, and `tr`; French, Russian, Tigrinya, and Turkish must remain disabled for delivery until human language approval is recorded. A rendered template is not proof of received mail.

### 5. Migration and observability

- Add a forward-only Liquibase change set and register it in the master changelog.
- Add unique constraints for tenant plus occurrence ID and tenant plus conversation room plus call ID.
- Index scheduled status plus start time for reminders and missed-call processing.
- Define the migration behavior for existing future appointments and group-chat occurrences. Leave uncertain historical links null instead of inventing call IDs.
- Emit structured logs and metrics for created occurrences, legal and rejected transitions, notification projection, and retry deduplication. Never log private message text, access tokens, or calendar payloads.

## Acceptance criteria

1. A consultant schedules one audio and one video call; the API and database return stable `scheduleId` and `callId` values.
2. The recipient sees the received/right-CTA event; the initiator sees the sent/left-CTA event after reload and on a second device.
3. Request, scheduled, accepted, and declined events use the matching semantic icon and the same logical timeline position.
4. Starting a scheduled call reuses its stored `callId`; it does not create a second timeline item.
5. Running membership and final attendance survive reload and match the persisted projection.
6. ICS, Google Calendar, and Outlook actions contain neutral calendar data and the correct start/end times.
7. Duplicate API, Matrix, scheduler, and notification deliveries remain single records and single user-visible events.
8. Authorization prevents a user from reading or mutating another tenant or unrelated conversation occurrence.
9. All offered languages render in Storybook; only human-approved locales are sent.
10. A real PreDev test with two controlled accounts proves create, accept/decline, schedule, join, leave, end/miss, reload, Activity Center, push where enabled, and actual received email.

## Required evidence for developer delivery

- exact branch and commit in each repository;
- migration and API diffs;
- Java 21 unit and integration test results;
- Frontend unit, Storybook, lint, TypeScript, application build, and Storybook build results;
- PreDev deployment image digest and service rollout state;
- database readback for the tested occurrence and call IDs;
- Playwright screenshots at desktop 1440 × 900 and mobile 390 × 844 for both sender directions and every status;
- two-account browser proof after reload;
- Activity Center readback and actual received email evidence;
- explicit statement of merge and release state.

## Current evidence boundary

- Frontend UI source: implemented, committed, and pushed at `0a0b9b91` on the branch named above.
- UserService lifecycle and notification source: committed on its own branch named above.
- PreDev Storybook: exact Frontend image `call-lifecycle-complete-0a0b9b91` deployed and browser-verified at desktop and mobile sizes.
- Production application integration: pending.
- Database-backed occurrence-to-call correlation: specified here, not implemented.
- Merged to `dev`: no.
- Released: no.
- Pull request: none created.
