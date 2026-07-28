# Activity Timeline & Notifications

The consultant- and client-facing history of everything that happens around a case: enquiries, accept/deny, messages, drafts, appointments, handovers, calls. It is **two things in one surface**: an **inbox** (events that happened _to_ you) and a **personal action trail** (events _you_ performed, e.g. drafts you saved). One central, paginated, navigable surface (Slack-"Activity"-style) plus the transient pop-ups that announce the same events. Spans **ORISO-Frontend** (the surface) and **ORISO-UserService** (the event model + persistence); chat content lives in **Matrix**.

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
Where an activity event's primary button takes you (`action_path`). **Rule: the target is wherever the event actually originated.** Most events that happen in a case → the **conversation** (chat room); enquiry events that originate in the request area → the **enquiry/request** view (note: "Call appointment requested" originates _in the chat_ today, so it targets the conversation, not the request view); a **draft event** → resume the draft where it lives. The button only appears on the focused/active event.
One target type is special — **Join**: a live-call event ("Call ongoing — N participants") does not navigate but _joins the call_ (the same action as the in-room call button). See **Calls** / stateful events.

**Event descriptor**:
The frontend's per-**event-type** definition that owns everything needed to render that event: its icon, its i18n title/text template, its category, and how to resolve its **action target**. The single registry that turns a typed, text-free server record into a rendered timeline card. Embodies the "every event gets its own icon + button" requirement.

**Handover** (= Reassign):
Moving an ongoing case to another counsellor. A **two-party** flow: the receiving **counsellor** _and_ the **client** must both confirm. States: **Requested** → **Partial** (exactly one party confirmed) → **All Confirmed** (both → handover takes effect). **Auto Confirmed** = a policy skipped a confirmation (e.g. same-agency / supervisor-initiated) or a timeout elapsed. **Denied** = either party refused → handover cancelled. "Partial" and "Auto Confirmed" are precise states, not loose adjectives.
_Avoid_: "transfer" (ambiguous with file transfer); using "Reassign" in UI copy — UI says "Handover" / "Übergabe"

**Self-event**:
An **activity event** whose actor is the signed-in user themselves — something _you did_, not something that happened to you. The first one is the **draft event**. Distinguishes the timeline's "personal action trail" half from its "inbox" half. (`recipient_user_id == actor`.)

**Draft event** ("Draft created"):
A **self-event** representing one of _your_ open, unsent message drafts, so you can find a draft you started and abandoned — without remembering whether it was in a request or which conversation. Its **action target** resumes the draft exactly where it lives (reusing the existing `forcedScopeKey` resume nav). Recommended implementation: **a live overlay rendered from the existing client-side draft index** (`scope:__draft-index__`), _not_ a persisted `event_notification` row — the index is already deduplicated and self-resolves (an entry vanishes when the draft is sent or discarded), so it sidesteps the append-only limitation. The draft body is _your own_ unsent text, hydrated client-side. A dedicated **`DraftsCenter`** / `/drafts` section already exists; the open decision is whether the timeline's Drafts family **replaces** it. _Only the author's own drafts — never "someone else created a draft"._

**Event family**:
The grouping an **event type** belongs to, used for the filter chips and shared iconography: Requests ("Anfragen"), Messages ("Nachrichten"), Drafts ("Entwürfe"), Appointments ("Termine"), Handover (the Reassign flow), Calls, System. Exactly one family chip can be active to scope the timeline; "Alle" shows everything.

**PrivacyEnvelope**:
The metadata-only representation of a Matrix message that reaches the backend — `messageId`, `roomId`, `senderId`, `timestamp`, `hasAttachment`, `contentClass`, and **never the plaintext body**. The contract that lets the server know "a message happened" without reading it.

**Active item** (global, not just timeline):
The single selected item across _any_ list — timeline event, conversation, or request. **Invariant: exactly one active item at a time**, derived from the current route (entering a chat room makes that conversation the active item). Strong treatment: lightened background + **2px focus ring in the graduated accent colour** + the red **action target** button. All others rest in the secondary, 1px-ring treatment with no button. Keyboard `focus-visible` is independent (a11y) and layers on top.
_The visual already exists in many places and must not be restyled._ What's broken is **robustness**: selection state is duplicated per component (`isChatActive`, `activeSession.rid === groupIdFromParam`, NotificationsCenter's own `--active`), so it breaks when touched, lets multiple items go red at once ("focus goes down the drain"), and never activates on entering a chat room. The fix is a **single, route-derived selection source of truth** (a Selection controller/hook), not new CSS.
_Avoid_: per-component active state, local `isActive` flags duplicated across list components

## Flagged ambiguities

- **"Notification" is overloaded.** Three different things: the **toast** (transient pop-up), the **activity event** (persisted timeline item), and the **email notification** (`EmailNotificationFacade`, transient, server-sent). Always qualify which one.
- **"Timeline" collision.** Matrix has its own **room timeline** (the message list inside a chat, listened to via `Room.timeline` in `matrixLiveEventBridge`). The **Activity Timeline** is _not_ the Matrix room timeline — it is a cross-room, cross-case history. Never conflate.
- **Source of truth for previews.** The server stores **no rendered display text at all** — only `event_type`, reference IDs, structured params, and read-state. _Every_ visible string (even business/system text like "Request accepted: {name}" or "Thema: {topic}") is rendered client-side from i18n templates per **event descriptor**. Chat message previews are additionally E2EE-protected and are hydrated client-side from the Matrix room. (See ADR-AT-01 "Storage & E2EE Boundary" in OrisoPlan WP-06.)
- **Two kinds of "stateful" — don't conflate (CONFIRMED).** `event_notification` is **append-only** (no correlation/status column, single-INSERT write path, only `markAsRead`; feed has no remove-single-item path). That is _fine_ for one kind and a problem for the other:
    - **Progression-as-history** — a **Handover** going requested → partial → all-confirmed/denied. Each transition is its own immutable fact and shows as its **own timeline card** (exactly the 5 Handover cards in Figma). Append-only handles this with no new mechanism.
    - **Live-until-resolved** — an open **draft**; an **ongoing, joinable call**. Must vanish/convert when done. Modelled as a **client-side overlay/projection from the authoritative source**, _not_ feed rows: drafts ← the draft index (decided); ongoing calls ← a call-liveness signal. The open architecture decision is whether to instead make `event_notification` itself stateful (add correlation_id + status + upsert) — heavier and inconsistent with the drafts decision.
- **Pre-existing plaintext-draft exposure (CONFIRMED).** `draft_message.text`, the draft **index JSON**, and the `title`/`action_path` columns are all stored server-side in **plaintext** (client encrypts only when RC-era E2EE is on → off for Matrix). Remediation findings (verified): **client-only is a regression** — the local `draftStore` is dead code, drafts+index live server-side only, and the timeline overlay already reads the server index (so it is already cross-device); dropping the server would empty the overlay until a new local path is built. **True zero-knowledge encryption is NOT blocked on Megolm**: a per-user, password-derived master key (`mk_<userId>`, PBKDF2→AES-256, the same key that wraps the RSA private key) already exists and is available at draft-save time — drafts are consultant/auth-scoped, exactly the population that has it. **Decided (2b — see ADR-AT-03 in OrisoPlan WP-06):** client-side encrypt draft text **and** the index JSON under the per-user master key (keep cross-device, server sees only ciphertext); harden PBKDF2 iterations. (Implemented in its own session.)
- **Live calls have no persistent event today (mapped).** `m.call.invite/answer/hangup` are only _logged_ by the backend (persistence is a TODO stub; answer/hangup don't even read `call_id`); `CALL_STARTED/ENDED/IGNORED_CALL` are in-room alias bubbles; participant count is **not tracked** (`m.call.member`/MSC3401 absent). So "call ongoing/ended/missed" timeline events + the "3 people in call" count are **new work**, not just wiring. **Join is feasible** by passing `call_room_id` + `isVideo` to `callManager.startCall` — but ⚠️ **two call stacks exist**: the legacy timeline join (`useJoinVideoCall` → `/videoanruf`) uses native matrix-js-sdk WebRTC; the new affordance must target the **LiveKit/ElementCall** stack (`callManager.startCall`), not the legacy hook.
  Live **participant count** ("3 in call") is **in scope** (full-calls decision). Recommended source of truth: **Matrix-RTC member state** (`m.call.member`/MSC3401), which ElementCall already maintains via `matrixRTC.getRoomSession()` and the client can subscribe to live; alternative is a backend query of the LiveKit room API. This is the live signal that gates the **Join** overlay.
- **Rocket.Chat vs Matrix.** Runtime and generated API contracts are Matrix-only. The integration branch removes Rocket.Chat cookies, headers, DTOs, account/room fields, and database columns; historical Liquibase changesets remain immutable migration history, not a compatibility path. `pre-dev` initializes Rust crypto and has real-browser Megolm proof. The current PreDev identity remains disposable until ADR-005's clean DNS-identity rebuild. Element Call uses host-owned Matrix widget mode and per-participant media E2EE as defined by ADR-018.

## Self-Help Group Chat & Lobby

_(Cross-repo feature. Canonical write model lives in **ORISO-UserService** (`Chat` + `GroupChatParticipant`); this section is the shared glossary. Decisions: extend the existing Group Chat feature + refactor in the touched radius; Matrix-only (no Rocket.Chat remnants); real E2EE via SDK **Megolm-first** (ADR-004/005); red-green TDD.)_

**Self-Help Group Chat** (Selbsthilfe-Gruppen-Chat):
The recurring, scheduled, consultant-owned, multi-participant chat. Canonical entity: UserService **`Chat`** (+ `GroupChatParticipant`). One `Chat` row already means "a group chat"; the reference wireframes (Caritas "Sonntag-Chat", "Dienstag-Chat", …) are instances of this.
_Avoid_: "peer chat", "Gruppenchat" (aliases), "conversation" (reserve for the consulting-type/registration concept).

**Group Chat Series vs. Occurrence** (decided — model A):
A **Series** is the single source-of-truth rule row (`start`, `interval`, **`repeatCount`**). **Occurrences are computed virtually** from the rule (iCal-RRULE-style); a Matrix room is materialised **only for the imminent/active** occurrence (extends today's rolling-row `ChatReCreator`). The "must be deleted manually" bug = today's series has **no end** (`nextStart()` rolls `WEEKLY` forever); a finite `repeatCount` makes it **auto-terminate** — no manual deletion, no per-occurrence row pile-up. Listing upcoming occurrences (Lobby) and calendar export ("next N appointments") are computed from the rule.
_**Interval**_: expand `Chat.ChatInterval` from `WEEKLY`-only to {DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY}; `nextStart()` computes per interval.

**Occurrence Exception / Override** (iCal `EXDATE`-style):
A background entry that makes the virtual-occurrence computation **skip** a specific future date ("this Tuesday is cancelled") without touching the Series rule; the same mechanism can **override** one occurrence's topic/time. Lets model A support single-date cancellations that a materialised-row model would get "for free".

**Future Timeline & the "Now" divider** (revises — and **replaces** — the earlier "Lobby in the Anfragen section", which is **dropped**):
Group chats live **directly in Gespräche/Chats** (the time-ordered conversation list, `MY_SESSION`) — **not** in the Anfragen/enquiry section. Upcoming scheduled occurrences are **not a separate list**: they are the **future extension of the same conversation list**, revealed by a **horizontal draggable divider** whose line marks **now** (the last past/current event). Default = divider at top, list shows past/current as today; drag it and the list no longer stops at the last chat but continues into the future (upcoming occurrences/events). Backend still distinguishes **past / active / upcoming** (upcoming = **virtual occurrences** computed from the Series rule, model A), but there is **no separate frontend Lobby surface** and the ENQUIRY triage flow stays untouched. When an occurrence opens it simply crosses **above** the now-line (active) and fires a system notification (Activity Timeline event).
Dragging is a **reveal-gesture into a timeline mode**, not a permanent re-sort — default stays today's time-of-last-message order (reading an item never reorders; only a new message bumps it), the future part just extends it forward. The future part shows **all upcoming events unified** (group-chat occurrences **+** AppointmentService appointments), chronological. **Pagination**: load ~**3 months** ahead, then a **"load more" button** (never materialise an unbounded recurring tail). It **respects the active `SessionToolbarChipFilter`**: no filter → all chats/events; a type filter (e.g. Group) → only that type, past **and** future.
_a11y (ADR-004)_: the drag interaction needs a non-drag equivalent (keyboard/toggle) for screen-reader & motor-impaired users.
_Avoid_: a separate "Lobby" list; putting occurrences into the ENQUIRY data type; conflating the Future Timeline (the list's future part) with the **Waiting Area** (the per-occurrence pre-open screen).

**Waiting Area** (Wartebereich):
The pre-open holding screen a participant lands in before the chat is open. Reuses the existing video `WaitingRoom` component (today video-conference-bound) and is **also** reused for live chat. Shows: a configurable **waiting-area system message**, a countdown to the occurrence, and cycling **Netiquette Rules**.
_Avoid_: "Lobby" (the Lobby is the list/holding concept; the Waiting Area is the screen).

**Occurrence lifecycle end** (decided):
An occurrence auto-closes at its **planned end** (`startDate + duration`) — reuses today's `DeactivateGroupChatService` stale-close machinery — after which the room is torn down and the Series rolls to the next occurrence (or completes at `repeatCount`). Past T-0 the Waiting-Area countdown **runs into the negative** with per-minute escalating "discomfort" emojis (moderator-is-late indicator), no dismissal, until planned end. **Any counsellor** (Owner _or_ Co-Moderator — not only the Owner) can also **end it early** via the room menu ("Event beenden" + confirmation popup).

**Deep-Link Join**:
A direct link to _today's_ occurrence that drops a participant straight into the **Waiting Area**. An unregistered person quick-registers first, then lands in the Waiting Area of the clicked occurrence.

**Netiquette Rule** (= "Spielregeln" = `groupChatRules` — **one concept, three names**, confirmed in code):
A short (**≤120 chars**), author-configured, **multilingual** conduct message, authored at chat-creation via a config popup (one tab per language), shown as horizontally-scrollable **label pills** cycling in the Waiting Area (~4 s each). **Today** `groupChatRules` is `[string]` on the **ConsultingType**, static in i18n files; the change **promotes it to per-Series author-authored data**, with the **ConsultingType rules kept as the default/fallback**. Distinct from the **Welcome/System Message** (`hintMessage`) — a single free per-Series message, also multilingual.

**Config-text translation** (reuses the Case-Handover/Legal module):
The multilingual authoring of Netiquette Rules + Welcome Message reuses **TenantService `TranslationFacade.translate(sourceLang, targetLangs[], fields)`** (provider-agnostic LLM: OpenRouter/Mistral; API keys global+masked) — the same module behind the Admin `TranslateOnPublishModal` for legal cards. Frontend is re-implemented in **MUI** (Admin's is Ant Design) but the backend contract + fallback are shared. **Boundary**: only **author-written config text** (rules/welcome) is ever sent to the LLM — **never chat content, never user PII** (those stay E2EE).
_Display fallback chain_: requested language → English → creator's source language → a standard canned phrase (present in all languages).

**Participant identity** (group chat):
Every participant is a **real Matrix identity** (needed for Megolm E2EE), on a spectrum: a hidden **auto-generated `anon_` account** (generated creds the user never sees; deactivated ~6 h / deleted ~47 h — the existing live-chat mechanism) is the low-threshold default; the user may **opt in to a persistent pseudonym** (own nickname, no PII, key-backup on) to be a recognised "regular" across recurring occurrences. There is **no** credential-less/ephemeral session — anonymity is achieved by disposable _real_ accounts, not by skipping accounts.

**Group Chat roles & ownership** (decided):
Membership is **explicit**, replacing the legacy implicit "all consultants of the chat's agencies are moderators" derivation (over-broad + E2EE-unsafe). Roles on `GroupChatParticipant`: **Owner** (moderator; **multiple owners allowed**, ownership **transferable** via the member menu), invited **Co-Moderators**, and client **Participants**. The invite picker is **tenant-scoped** (via the Agency→Tenant chain) — implemented as a **relaxable policy**, not hardcoded, so cross-tenant invites can be enabled later.

**Reachable Email** (opt-in):
An optional email the participant may add (end-of-conversation upgrade popup) — the **only recovery anchor** for auto-assigned passwords, plus the reminder channel. Lives on the **identity layer** (Keycloak/UserService), encrypted at rest, **never in the Matrix room**. Attaching it makes a pseudonym real-world-linkable, so it is always the user's opt-in choice.

**Confidentiality-neutral comms** (decision):
Because participation reveals sensitive facts (addiction self-help), all outbound artefacts that leave the E2EE boundary — **calendar entries (ICS), reminder & recovery emails** — carry a **neutral, non-sensitive, tenant-independent identity**: no topic, no Träger branding (Caritas/Kreuzbund), no "Sucht". **Reminder & recovery emails are content-free teasers** ("a session is coming up shortly — log in for details" / "restore your access") — all real content stays behind login, so the mail body leaks nothing and branding is moot; only the sender stays neutral. Calendar (ICS) title defaults to a neutral label, editable by the creator.

## Example dialogue

> **Dev:** When the client sends "Voll gut das du das so denkst", what does the server store?
> **Frank:** Nothing of the text. The server gets a **PrivacyEnvelope** — it knows there was a `message.new` **activity event** from that sender in that room at that time. The "Client replied: Voll gut…" preview is rendered in the client after it decrypts the Matrix message.
> **Dev:** And "Handover requested — Counsellor + Client must confirm"?
> **Frank:** That's a server-owned business fact, so the **activity event** carries its full text. It's not chat content.
> **Dev:** Clicking it?
> **Frank:** The **action target** of a handover event is the **conversation**; of a new enquiry it's the **request** view. The button only shows on the **active event**.
