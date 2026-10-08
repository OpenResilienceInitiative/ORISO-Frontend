# 01 — Analysis: what the Timeline does today, and where it falls short of the Slack-style expectation

Code read on `dev` @ `31dac29b` (2026-09-14). All references are `file:line`.
"Product decision" marks gaps that the code implements _on purpose_ following a
documented decision; they will not go away by fixing bugs, only by changing the
decision.

## Summary

The Timeline is a working **notification inbox** with a **read-only preview**.
It is not, and was never built to be, a **workspace** where you read _and act_
on a conversation without leaving the page. That is the gap between what the
code does and what the Slack comparison expects. Seven concrete findings:

| #   | Finding                                                                                              | Kind             | Where                                                          |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| F1  | The right pane shows a live chat for **3 of 31 event types** only; everything else is a text card    | product decision | `registry.ts:135-159`, `NotificationsCenter.tsx:695`           |
| F2  | The chat in the right pane is **read-only**: no composer, no reply, no read receipt, no active view  | product decision | `ConversationPreview.tsx:31-39`                                |
| F3  | The preview only renders rooms the client has **already synced**; otherwise a "not available" notice | defect-ish       | `ConversationPreview.tsx:66-71`, `chatTransportService.ts:312` |
| F4  | "Open chat" is a **full-page navigation away** from the Timeline; no way back except the nav bar     | architecture     | `RouterConfig.tsx:416-420`, `Routing.tsx:129-149`              |
| F5  | Feed freshness is a **15 s poll**; the backend pushes nothing (LiveService is a 410 tombstone)       | backend gap      | `NotificationsProvider.tsx:379-401`                            |
| F6  | Filter state is **ephemeral** (React state), there is no user-configurable "hide" and no auto-read   | missing feature  | `NotificationsCenter.tsx:262-266`, `timelineFilter.ts`         |
| F7  | The decisions behind F1/F2 live in an **unmerged ADR** (ORISO-Docs PR #108, Proposed since 09-05)    | governance       | ORISO-Docs `decisions/` (slot ADR-019 meanwhile taken)         |

Frank's phrase "momentan funktioniert das nur mit …" matches F1 exactly: the
in-place conversation appears only for `message.new`, `thread.reply.new` and
`team.discussion.new`.

## F1 — Which items get a conversation on the right

`resolveItemCategory` returns the descriptor's `category`. Only three seeds
are `category: 'message'` (`eventDescriptors/registry.ts:135-159`):

```ts
descriptor('message.new',       { family: 'messages', category: 'message', … })
descriptor('thread.reply.new',  { family: 'messages', category: 'message', … })
descriptor('team.discussion.new', { family: 'messages', category: 'message', … })
```

All other 28 seeded types (requests, handover, calls, supervisor changes,
appointments, …) are `category: 'system'` and render the text detail
(`NotificationsCenter.tsx:1266-1384`). The preview gate is one line:

```ts
const canShowChatPreview = selectedNotificationCategory === 'message'; // :695
```

Consequence for the user: an accepted enquiry, a handover request or a call
invite _has_ a room behind it (`resolveActionTarget: conversationTarget`), but
selecting it never shows that room — only the "Open chat" pill that navigates
away (F4). This is the "only works with …" experience.

**Why it is that way:** design feedback 2026-07-12 ("preview-first for chat
events", code comment `NotificationsCenter.tsx:623-629`) and the Proposed ADR
in ORISO-Docs PR #108 §2 both scope the preview to message events. Widening it
to every event that resolves to a conversation target is a small code change
(use `target.kind === 'conversation'` instead of the category) but a product
decision first.

## F2 — The right pane cannot be worked in

`ConversationPreview` (`ConversationPreview.tsx:31-39`, #847) is explicitly:

- read-only (no composer, no send path),
- no active-view registration (`apiPatchNotificationActiveView` is never
  called from here),
- no read receipts (the room's unread badge in "Gespräche" stays),
- last 50 cached events, no back-pagination, no attachments beyond a title.

This was a deliberate trade to fix a real bug: the previous iframe booted a
second SPA whose `SessionItemComponent` registered an active view and made the
backend suppress the very `message.new` events the Timeline shows. The
read-only preview cannot cause that. But it also means the Slack expectation
("I see the screen on the right and can answer there") is unmet by design.

**Two ways forward (product decision):**

- _(a) Keep the read-only preview_ and accept the Timeline as an inbox. Then
  F4 must at least be softened (open chat in the pane or keep a back link).
- _(b) Mount the real `SessionItemComponent` in the pane_ (issue #420
  "Real embedded conversation preview … render the session view component
  directly"). Doable — the supervision work already made the chat stage
  mountable as a `SidePanel` (`SessionItemComponent.tsx:56, 232-238`) — but it
  needs the suppression rule fixed first: registering an active view for the
  room must **not** hide that room's events from the Timeline while the
  Timeline is the surface showing them. That is a UserService rule
  (`activeViewByUserId`, see #1211 item 5), not a frontend toggle.

## F3 — Preview availability depends on client sync state (needs a live check)

```ts
const room = chatTransportService.getMatrixRoom(roomId);   // ConversationPreview.tsx:66
if (!room) { setRoomAvailable(false); … }                  // → "not available yet — open the chat"
```

`getMatrixRoom` is `client.getRoom(id)` (`chatTransportService.ts:312-317`):
it returns `null` for any room the current client has not synced yet (fresh
login before initial sync completes, rooms outside the lazy-loaded set, a room
the consultant was just added to). The user then sees the "not available"
notice.

**Recovery path that does exist:** the `onMatrixTimeline` subscription is
attached whenever `roomId` is set, even while the room is still absent
(`ConversationPreview.tsx:101-114`), and it is a client-wide `Room.timeline`
listener filtered by room id (`chatTransportService.ts:354-380`). So when the
initial sync delivers the room's timeline, `loadMessages` re-runs and the pane
normally recovers on its own. The residual case is a room that arrives
**without** a timeline event for it (empty room, or state-only lazy load), and
how often that happens is not known from the code. **Status:** not a confirmed
defect; verify on Pre-Dev (login, open Timeline immediately, select a message
card) before filing. If it reproduces, the fix is a `Room` listener plus a
"loading conversation…" state.

## F4 — The Timeline is a separate page, not a third column

- `/notifications` is a **profile route** (`RouterConfig.tsx:416-420`),
  rendered full-width by `Routing.tsx:129-149` in `contentWrapper__profile`.
- The sessions two-column layout (`SessionsZone.tsx:40-125`) only hosts
  `sessions/*` routes. The Timeline builds its own master-detail internally
  (`NotificationsCenter.tsx:879-1386`).
- Every "Open chat" action (`handleOpenAction`, `:752-769`; expander pill
  `:1095-1110`; menu `:1176-1193`) calls `navigate(directPath)` into
  `/sessions/consultant/sessionView/…`. The Timeline unmounts; selection and
  filter state are lost (F6). Returning means clicking the nav tile again and
  the first card is auto-selected and auto-read (`:654-667`).

In Slack, "open in channel" keeps Activity one click away and remembers where
you were. Here, the Timeline forgets. Minimal remedy without re-architecting:
persist `selectedNotificationId`, `activeFamily`, `unreadOnly`, `searchQuery`
in the URL (`?family=…&unread=1&item=…`) the same way `SessionsList` already
mirrors `?chip=` (`SessionsList.tsx:1177-1200`), and pass `?from=timeline`
so the chat view can render a back affordance.

## F5 — Nothing is pushed; the feed is a 15 s poll

`NotificationsProvider.tsx:379-383` polls every 15 s; the comment at
`:389-395` states there is no backend live push (LiveService transport is a
410 tombstone). Only events for rooms this client already syncs fire early via
`messageEventEmitter`. Everything created server-side through
`EventNotificationService.createEvent` (requests, handover, supervisor
changes, appointments) appears up to 15 s late. This was listed as backend item
1 in #1211 and is unchanged in ORISO-UserService `dev`. For an "activity"
surface that people keep open, 15 s is noticeable ("I got the email before the
Timeline showed it").

## F6 — Filters are not remembered and cannot hide anything

- `activeFamily`, `unreadOnly`, `searchQuery` are `useState`
  (`NotificationsCenter.tsx:262-268`). They reset on every navigation, and F4
  makes navigation constant.
- Chips are data-driven from the loaded page of the feed
  (`timelineFilter.ts:70-75`), so a family chip can vanish when "load older"
  or a refresh changes which families are present (`:596-604` clears the
  active family in that case).
- There is **no** user-level "never show me X here". The only per-family
  toggles that exist (`notificationSettings/model.ts:24-30`, `families`)
  govern _announcements_ (toast/sound/push), not the feed
  (`useNotificationSettings.ts:47`, `isSuppressed`). #592 asked for exactly
  the missing display filter on 2026-07-22; its model sub-issue #593 is
  closed, but the "apply to the feed" sub-issue #594 is open and nothing in
  `NotificationsCenter.tsx` reads a display setting.
- Auto-read exists only for the selected card (`:660-667`) and for the ✓✓
  bulk action. There is no "hidden ⇒ read" rule anywhere.
- The same is true one level up: the sessions list chips (`SessionsList.tsx:
258-262`) are URL-mirrored but not persisted, and there is no way to say
  "I never want to see supervision rooms in Gespräche".

The specification in [02-filter-spec.md](02-filter-spec.md) closes this gap.

## F7 — The "why" is not yet canonical

The answers to #1200 cite ADR-AT-01/02/03, which exist only in OrisoPlan
WP-06, and a new ADR drafted in ORISO-Docs PR #108. That PR is still open and
Proposed (nine days), and ORISO-Docs `dev` has meanwhile assigned **ADR-019**
to media scanning and continued to ADR-023 — so PR #108 needs renumbering
before it can merge. Until then every reviewer re-litigates "why is the
preview read-only?". Recommendation: renumber to the next free slot, merge as
Proposed, and let the product decisions from F1/F2 amend it.

## What is fine and should not be touched

- ✓✓ "Mark all as read" is correct and now disabled when nothing is unread
  (#1200, `MarkAllReadButton.tsx`, commits `6a281da0`, `7f6dea17`).
- The E2EE boundary holds: previews are hydrated client-side; the server
  stores no display text (`CONTEXT.md` L54, ADR-AT-01).
- Unread filter composes with family + search (`timelineFilter.ts:82-100`).
- Mobile (`untilL`) tap-to-open behaviour is consistent (`:738-750`).

## Suggested order of work (after product decisions on F1/F2)

1. **F6 → spec 02** (display filter, persistence, auto-read). Pure frontend
   plus one account-data key; no backend.
2. **F3** only if the live check reproduces it — small, isolated.
3. **F4 (minimal)**: URL-mirrored Timeline state + `?from=timeline` back link.
4. **F1** if approved: preview for every `conversation`-target event.
5. **F2 (b)** if approved: real chat stage in the pane — needs the
   UserService active-view/suppression rule first (#1211 item 5).
6. **F5**: push on `createEvent` (UserService) — outside this repo.
7. **F7**: renumber + merge the ADR.

## What was not verified

No Pre-Dev browser session was used. Whether F3 occurs at all, and whether F5's delay is
what Frank perceives as "not working", need a live reproduction with two
accounts; the reviewer test plan in the PR body walks it.
