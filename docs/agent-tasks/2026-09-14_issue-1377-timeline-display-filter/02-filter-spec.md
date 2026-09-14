# 02 — Specification: user-programmable display filter (global + per section)

Status: **Draft for product sign-off** (2026-09-14). Written against
`CONTEXT.md`, #592/#593/#594, #420, the Proposed Activity-Timeline ADR
(ORISO-Docs PR #108) and the code on `dev` @ `31dac29b`. Where a decision is
still Frank's to make it is listed in §10, not silently assumed.

## 1. Why this matters

A counsellor's list is not their to-do list. Today every event family the
backend emits lands in the Timeline, and every session kind the tenant enables
lands in Gespräche. The only tools are one transient chip per view and a search
box that forgets everything on the next click (analysis F6). The result is the
feeling "it still doesn't work like it should": the surface is correct but
**not the user's**.

**Without this spec:** a supervisor who only wants to see handover requests and
messages opens the Timeline, sees 40 supervisor-assignment and appointment
cards, clicks the "Messages" chip, opens one chat, comes back, and the chip is
gone again. The unread badge in the nav bar keeps counting the cards they never
wanted. They stop trusting the badge.

**With this spec:** the same supervisor opens the filter once, unticks
"Appointments" and "System", ticks "mark hidden as read", and from then on —
on every device — the Timeline shows only what they asked for, the badge counts
only that, and the chips they left on stay on.

## 2. Concepts (and what this is _not_)

| Term                      | Meaning                                                                                                            | Already exists?                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Display filter**        | What a list _shows_. Per section, user-owned, persisted, cross-device.                                             | No (this spec). #592 asked for the Timeline half.                  |
| **Chip filter**           | The transient refinement in the chip row (Unread, Drafts, one family, …). Composes _on top_ of the display filter. | Yes (`sessionToolbarFilters.ts`, `timelineFilter.ts`).             |
| **Announcement settings** | Whether an event _notifies_ (toast/sound/push/email). Per family, in Matrix account data.                          | Yes (`notificationSettings/model.ts`). **Untouched by this spec.** |
| **Auto-read rule**        | "What I hid, I consider read." Optional, per section. Never sends Matrix read receipts (§6).                       | No (this spec).                                                    |
| **Section**               | One of `requests` (Anfragen), `sessions` (Gespräche), `timeline` (Zeitstrahl).                                     | The three list surfaces already exist.                             |
| **Global**                | The default display filter every section inherits until it has its own override.                                   | No (this spec).                                                    |

The display filter never removes data (per #592): a dedicated chip can still
surface a hidden kind on demand, and the server-side feed is unchanged.

## 3. Where the user finds it

One **minimalist filter button** at the **right end of the chip row** under
the search field, in all three sections. It is the same primitive in all three
places (the chip row already is: `sessionsListToolbar__chipsRow` is shared by
`SessionsListToolbar.tsx:642-704` and `NotificationsCenter.tsx:906-960`).

```
┌─────────────────────────────────────────────────────────────┐
│ ⋮  Search activity…                                      🔍 │
├─────────────────────────────────────────────────────────────┤
│ [✉ Requests] [💬] [✎] [⇄] [📞]   [Unread]  ✓✓          [⚙︎•] │  ← new: filter button, dot = customised
└─────────────────────────────────────────────────────────────┘
```

- Icon: Material Symbols `tune` (M3 kit, same family as the chips). Icon-only
  pill, same size as an inactive chip, `aria-label="Display filter"`.
- A small dot on the icon when this section's effective filter differs from
  "show everything".
- Click → anchored popover (`Menu`/`Popover` from the MUI/M3 wrappers, like the
  card menu at `NotificationsCenter.tsx:1166-1235`). On `untilL` (mobile) the
  same content opens as a bottom sheet.
- Position: after ✓✓ in the Timeline, after the last chip in Anfragen and
  Gespräche. It is not a chip and must not scroll away with the chips: it is
  pinned right, the chips scroll under it.

Popover content (one column, no tabs):

```
Show in Zeitstrahl                      ← section name
  ☑ Requests        ☑ Messages
  ☑ Drafts          ☑ Handover
  ☑ Calls           ☐ System
  ☐ Appointments
──────────────────────────────────────
  ☑ Mark hidden items as read
──────────────────────────────────────
  Applies to:  (•) this section   ( ) all sections
  [Reset to default]        [Done]
```

- Checkbox rows are the section's **kinds** (§5). Ticked = shown.
- "Mark hidden items as read" = the auto-read rule (§6).
- "Applies to" decides whether the change is written to the section override
  or to the global default (§4). The radio remembers the last choice.
- "Reset to default" clears the section override (→ inherits global) or, when
  "all sections" is selected, resets global to show-everything.
- "Done" closes. Changes apply live while the popover is open (no Save).
- A last line links to the profile: "More options in Profile › Notifications"
  — the per-event-type granularity from #593 lives there, the popover stays
  family-level.

## 4. Scope resolution: global → section

```
effective(section) = section.override ?? global
```

- `global` is the fallback for every section. Default: show everything,
  auto-read off.
- A section override, once written, is complete (all keys), so a later change
  to `global` does not leak into it. "Reset to default" deletes the override.
- "Applies to: all sections" writes `global` **and** deletes every section
  override, so the user sees the same everywhere afterwards. That is the
  explicit, destructive case and gets a one-line confirmation in the popover
  ("This replaces the individual settings of Anfragen and Gespräche.").

**Without the two levels:** a user who hides "System" in the Timeline would
have to repeat it in Gespräche for supervision rooms, and a later "show
everything" in one place would silently un-hide it in the others.
**With them:** one global choice, overridden only where the user says so.

## 5. Kinds per section

The kinds are what the code can already tell apart without touching message
content (E2EE rule: metadata only, `sessionToolbarFilters.ts:69-75`).

### 5.1 Zeitstrahl (`timeline`)

| Kind (checkbox) | Maps to                                              | Source                         |
| --------------- | ---------------------------------------------------- | ------------------------------ |
| Requests        | `EventFamily 'requests'`                             | `eventDescriptors/registry.ts` |
| Messages        | `'messages'`                                         |                                |
| Drafts          | `'drafts'`                                           |                                |
| Handover        | `'handover'`                                         |                                |
| Calls           | `'calls'`                                            |                                |
| System          | `'system'`                                           |                                |
| Appointments    | `'appointments'` (only listed once any event exists) | `timelineFilter.ts:24-28`      |

Per-event-type toggles (e.g. hide `supervisor.renamed` but keep
`supervisor.assigned`) are **not** in the popover; they are the #593 profile
section and feed the same model (`hiddenEventTypes`, §7). The popover shows a
family as "partially hidden" (indeterminate checkbox) when only some of its
types are hidden there.

Rules:

- Hidden families are excluded from the feed **before** `getFamiliesInFeed`
  runs, so their chip disappears from the row (no chip for what you cannot
  see). The chip row does **not** grow a "hidden" chip; the filter button's
  dot is the only hint. _(Open question Q3 in §10 — #592 wanted the dedicated
  chip to still work; the button popover is the replacement affordance.)_
- Search and the Unread toggle operate on the already-reduced feed.
- The first-card auto-select (`NotificationsCenter.tsx:578-582`) picks from
  the reduced feed.
- "Load older" keeps paging the server feed until enough _visible_ items exist
  (the page can be all-hidden; the button must not stop early).
- The nav-bar unread badge counts **visible** unread only (§6.3).

### 5.2 Gespräche (`sessions`)

| Kind (checkbox)   | Maps to                                                       | Source                                      |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------- |
| One-to-one chats  | not group, modality ≠ live chat                               | `getModality`, `isInternalGroupChatSession` |
| Live chats        | `Modality.LIVE_CHAT` (only when the tenant enables live chat) | `showLiveChatChip`                          |
| Internal groups   | `isInternalGroupChatSession`                                  | `sessionToolbarFilters.ts:69-72`            |
| Circles           | `isConversationCircleSession`                                 | `sessionToolbarFilters.ts:63-67`            |
| Supervision rooms | `hasSupervisionMarker` / `getSupervisionListState`            | `sessionsListItem/supervisionListState.ts`  |
| Future timeline   | the Future Timeline panel/now-divider                         | `FutureTimelinePanel.tsx`                   |

Rules:

- A kind that the tenant does not enable is not listed (same gating as the
  chips, `SessionsListToolbar.tsx:392-415`).
- The active session is never hidden while it is open: hiding "Circles" while
  a circle is the active route keeps that one row visible and dims it, with the
  tooltip "Hidden by your display filter". Leaving the room removes it. This
  protects the "exactly one active item" invariant (`CONTEXT.md` L45-46).
- Hidden kinds are excluded from the toolbar chip counts (`chipCounts`).

### 5.3 Anfragen (`requests`)

The enquiry list is smaller; kinds are:

| Kind (checkbox)      | Maps to                                          |
| -------------------- | ------------------------------------------------ |
| Nearby (my agencies) | `'nearby'` semantics of `sessionMatchesToolbar`  |
| Live chats           | live-chat enquiries (tenant-gated)               |
| Anonymous enquiries  | anonymous registration sessions                  |
| Assigned to others   | enquiries already assigned to another consultant |

Auto-read is **not offered** here (§6.2): an unseen enquiry is a client
waiting, and "hidden ⇒ read" would hide that fact from the badge.

## 6. Auto-read rule

### 6.1 Zeitstrahl

When `autoReadHidden` is on for the Timeline, every **hidden** event that is
unread is marked read:

- on load of each feed page, for the items that page contains,
- on every refresh/poll that brings new hidden items.

Mechanics: `PATCH /service/users/event-notifications/{id}/read`
(`apiEventNotifications.ts`), batched client-side and debounced (one pass per
refresh, at most 50 ids per pass). Idempotent, so a lost response is retried
on the next refresh. No new backend endpoint is required for v1; a
`PATCH …/read?eventTypes=a,b` bulk endpoint is the obvious follow-up in
ORISO-UserService once the volume shows up in SigNoz.

This is exactly what the ✓✓ button does today for _everything_
(`NotificationsProvider.markAllNotificationsAsRead`); the rule applies it to a
subset the user chose. It never touches Matrix read receipts (ADR-AT-01, #1200
JOB1 answer).

**Without auto-read:** hidden families still count in the server-side unread
total, so the nav badge says "12" while the Timeline shows 3 unread. The user
presses ✓✓ to make the number go away and thereby also reads the 3 they wanted.
**With auto-read:** the badge and the list agree, and ✓✓ acts only on what is
visible.

### 6.2 Gespräche and Anfragen

Auto-read is offered in Gespräche as **"Don't count hidden chats as unread"**
and only affects the local unread computation (`isChatItemUnread` consumers and
the nav badge). It **never** sends a Matrix read receipt and never calls the
active-view PATCH: a receipt tells the client "the consultant saw this", which
must stay a deliberate act (privacy boundary in `CONTEXT.md` L53-54 and
ADR-004/005). In Anfragen the option is not shown (§5.3).

### 6.3 Unread badge

The nav badge for the Timeline is today driven by the server total
(commit `7f6dea17`). With display filters it must show **visible unread**:

- v1 (frontend only): `serverTotal − hiddenUnreadInLoadedPages`. Exact when
  auto-read is on (hidden unread converges to 0), an upper bound when it is
  off. The badge tooltip says "+N hidden" in the latter case.
- v2 (backend): `GET …/event-notifications/unread-count?excludeEventTypes=`
  in ORISO-UserService. Filed as a follow-up when v1 lands.

## 7. Model and persistence

New key in the existing cross-device store (Matrix account data,
`notificationSettings/store.ts`), **separate** from the announcement settings so
a parser bug in one cannot wipe the other:

```ts
// account-data event type: 'org.oriso.display_filters'  (v1)
interface OrisoDisplayFilters {
	version: 1;
	global: DisplayFilter;
	sections: Partial<
		Record<'timeline' | 'sessions' | 'requests', DisplayFilter>
	>;
	/** Last "Applies to" choice in the popover. */
	lastScope: 'section' | 'global';
}

interface DisplayFilter {
	/** Kinds the user hid; anything not listed is shown. */
	hiddenKinds: string[]; // timeline: EventFamily[]; sessions/requests: §5 ids
	/** Timeline only, written by the profile section (#593). */
	hiddenEventTypes?: string[];
	/** §6 — timeline: mark read; sessions: don't count. Ignored for requests. */
	autoReadHidden: boolean;
}
```

- Tolerant parsing exactly like `parseNotificationConfig`: unknown kinds are
  kept (a newer client may know them), unknown keys ignored, malformed →
  defaults. Defaults = `{ hiddenKinds: [], autoReadHidden: false }`.
- localStorage mirror `ORISO_DISPLAY_FILTERS` for pre-sync and Storybook.
- A `useDisplayFilter(section)` hook returns `{ effective, override, global,
setSection, setGlobal, resetSection }` and re-renders on account-data sync
  (same `useSyncExternalStore` pattern as `useNotificationSettings.ts`).
- Pure helpers in one module (`displayFilter/model.ts`): `resolveEffective`,
  `applyTimelineFilter(items)`, `applySessionsFilter(items)`, each with tests.
  `timelineFilter.ts` gains one pre-step and otherwise stays as is.

**Without account data:** the filter would be per browser (like the old
`BROWSER_NOTIFICATIONS` key that caused #1211 root cause B) and a counsellor
using desk and laptop would configure twice and get two different badges.
**With it:** the same mechanism the announcement settings already trust.

## 8. Interaction with what exists

| Existing behaviour                                 | With display filter                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Family chips data-driven from the feed             | computed from the **visible** feed → hidden families have no chip           |
| Unread toggle skips auto-read of the selected card | unchanged; auto-read of hidden items is a separate pass and still runs      |
| ✓✓ Mark all as read                                | unchanged (server-side, everything). Copy stays "Mark all as read".         |
| Announcement `families` toggles                    | independent. Hiding a family does **not** mute it; muting does not hide it. |
| `?chip=` URL mirror in SessionsList                | unchanged; chip composes on top                                             |
| Profile › Notifications (#593 section)             | becomes the "advanced" view of the same model (per event type)              |
| Storybook stories for both toolbars                | get a `withDisplayFilter` story each (dot on, popover open)                 |

## 9. Acceptance criteria

- [ ] AC1 All three sections show the filter button at the right end of the chip row; icon-only, dot when customised, keyboard reachable, `aria-expanded`.
- [ ] AC2 Unticking a kind removes those items from the list immediately, on this and (after sync) on a second device.
- [ ] AC3 "Applies to: this section" leaves the other two sections unchanged; "all sections" makes all three identical and shows the confirmation line.
- [ ] AC4 Timeline: with auto-read on, hidden unread items are marked read server-side within one refresh; the nav badge equals the visible unread count.
- [ ] AC5 Timeline: with auto-read off, the badge shows visible unread and a "+N hidden" tooltip; ✓✓ still clears everything.
- [ ] AC6 Gespräche: an open room stays visible while hidden by the filter (dimmed, tooltip), and disappears after leaving it. No Matrix read receipt is ever sent by the filter (checked with the room's receipt list).
- [ ] AC7 Anfragen: no auto-read option is rendered.
- [ ] AC8 Reset restores inheritance; a malformed account-data blob falls back to defaults without an error boundary.
- [ ] AC9 No message content is read anywhere in the filter path (metadata only); unit tests for `applyTimelineFilter`, `applySessionsFilter`, `resolveEffective`, tolerant parsing.

## 10. Open decisions for Frank (answer inline, then the spec is final)

- **Q1 Default for auto-read in the Timeline** — off (safer, badge stays honest with "+N hidden") or on (the described "sofort als gelesen markiert")? _Recommendation: off by default, one-click on in the popover._
- **Q2 Read receipts in Gespräche** — confirm they are never sent by the filter (this spec says never). If "hidden ⇒ read" should also clear the room badge for _other_ devices, that needs a receipt and is a privacy decision.
- **Q3 Chip of a hidden family** — disappear (this spec) or stay as a dimmed chip that temporarily un-hides on click (#592 wording)? _Recommendation: disappear; the popover is one click away and the row stays clean._
- **Q4 Granularity in the popover** — families only (this spec) with per-type in the profile, or per-type right in the popover?
- **Q5 Global vs section precedence** — section override wins (this spec). Alternative: global always applies _and_ sections can only hide more. Simpler to explain, less flexible.
- **Q6 Product owner of the profile page section** — #593 is closed as done; the spec assumes that UI is the advanced view. If it was closed without UI, it reopens as part of this work.
- **Q7 Mobile** — bottom sheet with the same content (this spec) or defer mobile?
- **Q8 Order of delivery** — the analysis suggests filter (F6) before widening the preview (F1/F2). Agree?

## 11. Implementation slices (for the issue)

1. **Model + store + hook** (`src/utils/displayFilter/*`, account-data key, mirror, tests). No UI.
2. **Timeline**: pre-filter + auto-read pass + badge v1 + button/popover in `NotificationsCenter`. Stories.
3. **Gespräche**: pre-filter + active-row exception + "don't count" + button in `SessionsListToolbar`. Stories.
4. **Anfragen**: pre-filter + button (no auto-read).
5. **Profile**: wire #593's section to `hiddenEventTypes`.
6. **Backend follow-ups** (ORISO-UserService): bulk read by event type; unread-count with exclusions.

Each slice is a separate PR with a Storybook before/after under
`docs/storybook/issue-<n>-display-filter/`.
