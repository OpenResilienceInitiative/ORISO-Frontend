# Activity Timeline & Notifications

The consultant- and client-facing history of everything that happens around a case: enquiries, accept/deny, messages, drafts, appointments, handovers, calls. It is **two things in one surface**: an **inbox** (events that happened *to* you) and a **personal action trail** (events *you* performed, e.g. drafts you saved). One central, paginated, navigable surface (Slack-"Activity"-style) plus the transient pop-ups that announce the same events. Spans **ORISO-Frontend** (the surface) and **ORISO-UserService** (the event model + persistence); chat content lives in **Matrix**.

## Language

**Activity Timeline**:
The single central surface that lists all **activity events** for the signed-in user as a scrollable, clickable history with a detail pane. Canonical name for what the code/Figma variously call Activity Feed / Aktivität / Zeitstrahl / Notifications Center.
_Avoid_: Activity Feed, Aktivität, Zeitstrahl, Notifications Center, Notifications Page (all aliases for this one surface)

**Activity event**:
One persistent item in the timeline (e.g. "Request accepted", "Handover requested"). Has an **event type**, an actor/subject, a timestamp, a read-state, and an optional **action target**. Stored in `event_notification` (UserService).
_Avoid_: Notification (reserve that for the transient pop-up)

**Event type**:
The string key that identifies what an activity event is (`inquiry.accepted`, `message.new`, `thread.reply.new`, `supervisor.added`, …). Drives the event's icon, label, and action target. Currently string-based, no central enum.

**Toast notification**:
The transient, auto-dismissing pop-up (`components/notifications`) that announces an event as it arrives. Distinct from an **activity event**: a toast is ephemeral, an activity event is the persisted record of the same thing.
_Avoid_: Notification (ambiguous), Alert

**Action target**:
Where an activity event's primary button takes you (`action_path`). **Rule: the target is wherever the event actually originated.** Most events that happen in a case → the **conversation** (chat room); enquiry events that originate in the request area → the **enquiry/request** view (note: "Call appointment requested" originates *in the chat* today, so it targets the conversation, not the request view); a **draft event** → resume the draft where it lives. The button only appears on the focused/active event.
One target type is special — **Join**: a live-call event ("Call ongoing — N participants") does not navigate but *joins the call* (the same action as the in-room call button). See **Calls** / stateful events.

**Event descriptor**:
The frontend's per-**event-type** definition that owns everything needed to render that event: its icon, its i18n title/text template, its category, and how to resolve its **action target**. The single registry that turns a typed, text-free server record into a rendered timeline card. Embodies the "every event gets its own icon + button" requirement.

**Handover** (= Reassign):
Moving an ongoing case to another counsellor. A **two-party** flow: the receiving **counsellor** *and* the **client** must both confirm. States: **Requested** → **Partial** (exactly one party confirmed) → **All Confirmed** (both → handover takes effect). **Auto Confirmed** = a policy skipped a confirmation (e.g. same-agency / supervisor-initiated) or a timeout elapsed. **Denied** = either party refused → handover cancelled. "Partial" and "Auto Confirmed" are precise states, not loose adjectives.
_Avoid_: "transfer" (ambiguous with file transfer); using "Reassign" in UI copy — UI says "Handover" / "Übergabe"

**Self-event**:
An **activity event** whose actor is the signed-in user themselves — something *you did*, not something that happened to you. The first one is the **draft event**. Distinguishes the timeline's "personal action trail" half from its "inbox" half. (`recipient_user_id == actor`.)

**Draft event** ("Draft created"):
A **self-event** representing one of *your* open, unsent message drafts, so you can find a draft you started and abandoned — without remembering whether it was in a request or which conversation. Its **action target** resumes the draft exactly where it lives (reusing the existing `forcedScopeKey` resume nav). Recommended implementation: **a live overlay rendered from the existing client-side draft index** (`scope:__draft-index__`), *not* a persisted `event_notification` row — the index is already deduplicated and self-resolves (an entry vanishes when the draft is sent or discarded), so it sidesteps the append-only limitation. The draft body is *your own* unsent text, hydrated client-side. A dedicated **`DraftsCenter`** / `/drafts` section already exists; the open decision is whether the timeline's Drafts family **replaces** it. *Only the author's own drafts — never "someone else created a draft".*

**Event family**:
The grouping an **event type** belongs to, used for the filter chips and shared iconography: Requests ("Anfragen"), Messages ("Nachrichten"), Drafts ("Entwürfe"), Appointments ("Termine"), Handover (the Reassign flow), Calls, System. Exactly one family chip can be active to scope the timeline; "Alle" shows everything.

**PrivacyEnvelope**:
The metadata-only representation of a Matrix message that reaches the backend — `messageId`, `roomId`, `senderId`, `timestamp`, `hasAttachment`, `contentClass`, and **never the plaintext body**. The contract that lets the server know "a message happened" without reading it.

**Active item** (global, not just timeline):
The single selected item across *any* list — timeline event, conversation, or request. **Invariant: exactly one active item at a time**, derived from the current route (entering a chat room makes that conversation the active item). Strong treatment: lightened background + **2px focus ring in the graduated accent colour** + the red **action target** button. All others rest in the secondary, 1px-ring treatment with no button. Keyboard `focus-visible` is independent (a11y) and layers on top.
_The visual already exists in many places and must not be restyled._ What's broken is **robustness**: selection state is duplicated per component (`isChatActive`, `activeSession.rid === groupIdFromParam`, NotificationsCenter's own `--active`), so it breaks when touched, lets multiple items go red at once ("focus goes down the drain"), and never activates on entering a chat room. The fix is a **single, route-derived selection source of truth** (a Selection controller/hook), not new CSS.
_Avoid_: per-component active state, local `isActive` flags duplicated across list components

## Flagged ambiguities

- **"Notification" is overloaded.** Three different things: the **toast** (transient pop-up), the **activity event** (persisted timeline item), and the **email notification** (`EmailNotificationFacade`, transient, server-sent). Always qualify which one.
- **"Timeline" collision.** Matrix has its own **room timeline** (the message list inside a chat, listened to via `Room.timeline` in `matrixLiveEventBridge`). The **Activity Timeline** is *not* the Matrix room timeline — it is a cross-room, cross-case history. Never conflate.
- **Source of truth for previews.** The server stores **no rendered display text at all** — only `event_type`, reference IDs, structured params, and read-state. *Every* visible string (even business/system text like "Request accepted: {name}" or "Thema: {topic}") is rendered client-side from i18n templates per **event descriptor**. Chat message previews are additionally E2EE-protected and are hydrated client-side from the Matrix room. (See ADR-AT-01 "Storage & E2EE Boundary" in OrisoPlan WP-06.)
- **Two kinds of "stateful" — don't conflate (CONFIRMED).** `event_notification` is **append-only** (no correlation/status column, single-INSERT write path, only `markAsRead`; feed has no remove-single-item path). That is *fine* for one kind and a problem for the other:
  - **Progression-as-history** — a **Handover** going requested → partial → all-confirmed/denied. Each transition is its own immutable fact and shows as its **own timeline card** (exactly the 5 Handover cards in Figma). Append-only handles this with no new mechanism.
  - **Live-until-resolved** — an open **draft**; an **ongoing, joinable call**. Must vanish/convert when done. Modelled as a **client-side overlay/projection from the authoritative source**, *not* feed rows: drafts ← the draft index (decided); ongoing calls ← a call-liveness signal. The open architecture decision is whether to instead make `event_notification` itself stateful (add correlation_id + status + upsert) — heavier and inconsistent with the drafts decision.
- **Pre-existing plaintext-draft exposure (CONFIRMED).** `draft_message.text`, the draft **index JSON**, and the `title`/`action_path` columns are all stored server-side in **plaintext** (client encrypts only when RC-era E2EE is on → off for Matrix). Remediation findings (verified): **client-only is a regression** — the local `draftStore` is dead code, drafts+index live server-side only, and the timeline overlay already reads the server index (so it is already cross-device); dropping the server would empty the overlay until a new local path is built. **True zero-knowledge encryption is NOT blocked on Megolm**: a per-user, password-derived master key (`mk_<userId>`, PBKDF2→AES-256, the same key that wraps the RSA private key) already exists and is available at draft-save time — drafts are consultant/auth-scoped, exactly the population that has it. **Decided (2b — see ADR-AT-03 in OrisoPlan WP-06):** client-side encrypt draft text **and** the index JSON under the per-user master key (keep cross-device, server sees only ciphertext); harden PBKDF2 iterations. (Implemented in its own session.)
- **Live calls have no persistent event today (mapped).** `m.call.invite/answer/hangup` are only *logged* by the backend (persistence is a TODO stub; answer/hangup don't even read `call_id`); `CALL_STARTED/ENDED/IGNORED_CALL` are in-room alias bubbles; participant count is **not tracked** (`m.call.member`/MSC3401 absent). So "call ongoing/ended/missed" timeline events + the "3 people in call" count are **new work**, not just wiring. **Join is feasible** by passing `call_room_id` + `isVideo` to `callManager.startCall` — but ⚠️ **two call stacks exist**: the legacy timeline join (`useJoinVideoCall` → `/videoanruf`) uses native matrix-js-sdk WebRTC; the new affordance must target the **LiveKit/ElementCall** stack (`callManager.startCall`), not the legacy hook.
  Live **participant count** ("3 in call") is **in scope** (full-calls decision). Recommended source of truth: **Matrix-RTC member state** (`m.call.member`/MSC3401), which ElementCall already maintains via `matrixRTC.getRoomSession()` and the client can subscribe to live; alternative is a backend query of the LiveKit room API. This is the live signal that gates the **Join** overlay.
- **Rocket.Chat vs Matrix.** Notification delivery is already Matrix-native (`MatrixEventListenerService` `/sync`), but `useE2EE` still implements the *Rocket.Chat* E2EE scheme and skips Matrix rooms. "We do notifications via Rocket.Chat" is no longer true; "client E2EE is still Rocket.Chat-shaped" is.

## Example dialogue

> **Dev:** When the client sends "Voll gut das du das so denkst", what does the server store?
> **Frank:** Nothing of the text. The server gets a **PrivacyEnvelope** — it knows there was a `message.new` **activity event** from that sender in that room at that time. The "Client replied: Voll gut…" preview is rendered in the client after it decrypts the Matrix message.
> **Dev:** And "Handover requested — Counsellor + Client must confirm"?
> **Frank:** That's a server-owned business fact, so the **activity event** carries its full text. It's not chat content.
> **Dev:** Clicking it?
> **Frank:** The **action target** of a handover event is the **conversation**; of a new enquiry it's the **request** view. The button only shows on the **active event**.
