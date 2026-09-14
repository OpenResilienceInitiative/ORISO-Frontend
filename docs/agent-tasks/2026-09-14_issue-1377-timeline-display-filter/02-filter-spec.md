# 02 — Specification: user-programmable display filter (global + per section)

Status: **Decided** (2026-09-14, Frank: "take the recommendations for Q1–Q8"; §10 records the answers and the additional product input that reshaped §3/§5/§11). Written against
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
gone again. The ✓✓ button and the server-side unread total keep counting the
cards they never wanted, and the navigation rail has no Timeline badge at all.
They stop trusting the count.

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

The display filter never removes data (the intent of #592): the server-side
feed and the sessions data are unchanged, and the popover un-hides a kind with
one tick. What #592 phrased as "the dedicated chip still shows hidden events"
is replaced by that popover affordance — a hidden kind has **no chip** (§5.1).
Q3 in §10 records the alternative so Frank can overrule.

## 3. Where the user finds it

One **minimalist filter button** at the **right end of the chip row** under
the search field, in all three sections. It is the same primitive in all three
places (the chip row already is: `sessionsListToolbar__chipsRow` is shared by
`SessionsListToolbar.tsx:642-704` and `NotificationsCenter.tsx:906-960`).

```text
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
- Click → the **M3 dialog** described below (`DisplayFilterDialog`, modal,
  480 px wide on desktop). On `untilL` (mobile) the same dialog opens
  full-screen (Q7); there is no separate bottom sheet and **no anchored
  popover** — one presentation, decided in §10 (Q7) and shipped in slice 1.
- Position: after ✓✓ in the Timeline, after the last chip in Anfragen and
  Gespräche. It is not a chip and must not scroll away with the chips: it is
  pinned right, the chips scroll under it.

Dialog content — an M3 dialog (`Dialog` from the repo's MUI/M3 wrappers,
built and reviewed in Storybook **before** any integration, §11):

```text
Anzeige-Filter · Zeitstrahl                   ← section name
                         Anzeigen   Pille
  Anfragen                  ☑         ☑
  Nachrichten               ☑         ☑
  Entwürfe                  ☐         ─      ← hidden ⇒ pill column disabled
  Übergaben                 ☑         ☐
  Anrufe                    ☑         ☑
  System                    ☑         ☐
  Termine                   ☐         ─
  Sonstiges                 ☑ (fixed) ☐      ← catch-all, cannot be hidden
──────────────────────────────────────────
  ☑ Ausgeblendetes sofort als gelesen markieren
──────────────────────────────────────────
  [Auf meine Standards zurücksetzen]   [Fertig]
```

Two independent switches per kind (Frank, 2026-09-14):

- **Anzeigen (show)** — whether items of this kind appear in the list at all.
  Off means the kind is gone from this section: no rows, no pill, no entry
  in the history — "as if the event class did not exist for me" (example:
  drafts in the chat history — Slack does not show them, some counsellors
  want them).
- **Pille (pill)** — whether the kind gets a chip in the chip row. A pill is
  rendered **only while the kind has unread/new items** in the loaded feed
  (e.g. a request in a group chat → the "Gruppen" pill appears at the top
  with a count badge); it disappears again when nothing new is left, unless
  it is the active chip. Pill requires Show; hiding a kind greys out its
  pill switch.
- **Sonstiges (other)** — the catch-all for every kind/event the section does
  not map explicitly (new backend event types, future families). It is
  **always shown** (switch fixed on) so nothing can silently vanish, and it
  can be given a pill. This keeps the backend contract small: the server
  needs no knowledge of the filter, and unmapped events land in a bucket
  the user can still see.

- "Ausgeblendetes sofort als gelesen markieren" = the auto-read rule (§6).
- The popover edits the **section override** only (§4).
- "Auf meine Standards zurücksetzen" clears the section override, so the
  section falls back to the user's global defaults for that section.
- "Fertig" closes. Changes apply live while the dialog is open (no Save).
- A last line links to the profile: "Standards und mehr Optionen in Profil ›
  Benachrichtigungen" — the **global defaults** (§4) and the per-event-type
  granularity from #593 live there, the dialog stays family-level.

## 4. Scope resolution: global defaults → section override

```text
effective(section) = sections[section] ?? global[section]
```

Each section has its own kind vocabulary (§5), so "global" is **not** one
filter applied to all three lists — that would give `kinds.messages`
no meaning in Anfragen. Global is the user's **default per section**, edited in
one place (Profile › Notifications › Display filters, the #593 section), while
the popover in a list edits only that list's **override**:

- `global[section]` — the default for that section on every device. Ships as
  show-everything, auto-read off.
- `sections[section]` — an optional override written by the popover. It
  carries **only** the fields the popover can edit (family-level `kinds`
  and `autoReadHidden`). The profile-owned `hiddenEventTypes` is **never**
  copied into an override; it is always resolved from `global[section]`, so
  a per-event-type change in the profile takes effect immediately even while
  an override exists:
  `effective = { ...global[section], ...sections[section], hiddenEventTypes: global[section].hiddenEventTypes }`.
  Once written, a later change to the profile's family-level defaults does
  not leak into the override (tests: profile hides `supervisor.renamed`,
  popover hides "Calls" → both hidden; profile then also hides
  `counselor.renamed` → hidden too, without touching the override).
- "Reset to my defaults" deletes the override.
- The profile page shows all three sections side by side, and its
  "Apply to all sections" action is limited to what more than one section can
  interpret: `autoReadHidden` is written to `timeline` and `sessions` only
  (never to `requests`, which has no auto-read, §5.3/§6.2), and the shared
  kind id `liveChat` is written to `sessions` and `requests`. Everything else
  is per section by construction, so nothing can be written that a section
  cannot interpret.

**Without the two levels:** a user who hides "Supervision" in Gespräche for
one busy week has no way back to "my usual view" except remembering it.
**With them:** the popover is the quick, per-list override; the profile holds
the considered defaults; reset goes from one to the other.

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
  dot is the only hint (Q3 decided).
- The chip row is now **user-gated**: a family chip renders only if
  `kinds[family].pill` is on **and** the family has unread items in the
  loaded feed (count badge), or it is the active chip. Today's "one chip per
  family present" rule becomes the default (`pill: true` everywhere).
- **Sonstiges**: event types without a family mapping (today none — every
  seeded type has a family — but the registry falls back to `system` for
  unknown types, `registry.ts:99`) are classified as `other`, always shown,
  and get their own chip when `kinds.other.pill` is on.
- Search and the Unread toggle operate on the already-reduced feed.
- The first-card auto-select (`NotificationsCenter.tsx:578-582`) picks from
  the reduced feed.
- "Load older" keeps paging the server feed until enough _visible_ items exist
  (the page can be all-hidden; the button must not stop early).
- The (new) nav-rail unread badge counts **visible** unread only (§6.3).

### 5.2 Gespräche (`sessions`)

| Kind (checkbox)   | Maps to                                                                                                                                                                                                                                                                     | Source                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| One-to-one chats  | not group, modality ≠ live chat, **and not a supervision room**                                                                                                                                                                                                             | `getModality`, `hasSupervisionMarker` |
| Live chats        | `Modality.LIVE_CHAT` (only when the tenant enables live chat)                                                                                                                                                                                                               | `showLiveChatChip`                    |
| Internal groups   | `isInternalGroupChatSession`                                                                                                                                                                                                                                                | `sessionToolbarFilters.ts:69-72`      |
| Circles           | `isConversationCircleSession`                                                                                                                                                                                                                                               | `sessionToolbarFilters.ts:63-67`      |
| Supervision rooms | the `supervision` chip predicate of `sessionMatchesToolbar` (marker present **and** `getSupervisionListState(…, currentUserId) === 'supervisedByMe'`, with its legacy fallback) — never bare `hasSupervisionMarker`, which is true for an empty marker on ordinary sessions | `sessionToolbarFilters.ts:246-262`    |
| Future timeline   | the Future Timeline panel/now-divider                                                                                                                                                                                                                                       | `FutureTimelinePanel.tsx`             |

Rules:

- A kind that the tenant does not enable is not listed (same gating as the
  chips, `SessionsListToolbar.tsx:392-415`).
- The active session is never hidden while it is open: hiding "Circles" while
  a circle is the active route keeps that one row visible and dims it, with the
  tooltip "Hidden by your display filter". Leaving the room removes it. This
  protects the "exactly one active item" invariant (`CONTEXT.md` L45-46).
- Hidden kinds are excluded from the toolbar chip counts (`chipCounts`).
- **Keep paging until something is visible** (same rule as the Timeline,
  §5.1): the sessions list loads pages only from `handleListScroll`
  (`SessionsList.tsx:1007-1032`), so a first page made entirely of hidden
  kinds would render an empty, non-scrollable list and never request the
  older visible rows. After `applySessionsFilter` / `applyRequestsFilter`
  runs, if fewer than one screen of visible rows exist and
  `totalItems > currentOffset + SESSION_COUNT`, call `loadMoreSessions`
  again (bounded: stop at the server total, and show the list's loading
  state meanwhile). Server-side kind filtering is the v2 alternative.
- The kind predicates are **extracted from `sessionMatchesToolbar`** into
  `displayFilter/model.ts` (one `classifySession(raw, extended, currentUserId)`
  returning exactly one kind) so the chip filter and the display filter can
  never disagree on what a row is.
- The kinds are **disjoint** and evaluated in this order: supervision room →
  circle → internal group → live chat → one-to-one. A supervised case is an
  ordinary non-group counselling session (`SessionsListToolbar.stories.tsx:
317-339`), so it is a "Supervision room", never a "One-to-one chat"; hiding
  one-to-one chats leaves supervised cases visible.
- "Future timeline" is gated **independently of the row filter**: the
  `futureTimelineSeries` input (`SessionsList.tsx:1624-1640`) is derived from
  the session set **before** the display filter is applied, and the checkbox
  only decides whether the panel renders. Hiding "Circles" therefore does not
  remove the future panel while "Future timeline" is still ticked.

### 5.3 Anfragen (`requests`)

The enquiry list is smaller; kinds are (enquiries already assigned to another
consultant are not a kind — `SessionsList.filterSessions` drops them before any
toolbar filtering, `SessionsList.tsx:1352-1355`, so a checkbox could never
show them):

| Kind (checkbox)      | Maps to                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nearby (my agencies) | `'nearby'` semantics of `sessionMatchesToolbar`                                                                                                                                                                 |
| Live chats           | `isAnonymousAskerSession` = `Modality.LIVE_CHAT` (tenant-gated). There is no separate "anonymous" kind: on `dev` anonymous and live-chat enquiries are the same predicate (`sessionToolbarFilters.ts:109-114`). |

Auto-read is **not offered** here (§6.2): an unseen enquiry is a client
waiting, and "hidden ⇒ read" would hide that fact from the badge.

## 6. Auto-read rule

### 6.1 Zeitstrahl

When `autoReadHidden` is on for the Timeline, every **hidden** event that is
unread is marked read:

- on load of each feed page, for the items that page contains,
- on every refresh/poll that brings new hidden items,
- **on every change of the effective Timeline filter** (a family unticked in
  the popover, `autoReadHidden` switched on, a profile change synced in from
  another device): the pass runs immediately over the already-loaded pages,
  so items that just became hidden do not stay unread until the next poll.
  Acceptance case: 10 unread "System" cards loaded → user unticks "System"
  with auto-read on → all 10 are PATCHed within the debounce window.

Mechanics: `PATCH /service/users/event-notifications/{id}/read`
(`apiEventNotifications.ts`), batched client-side and debounced: one pass per
refresh, processed in chunks of 50 ids **until the loaded set is drained** (a
user who has paged deep and then hides a family can have far more than 50).
**Confirmed-success only:** the pass must **not** reuse the existing
`markNotificationAsRead`, which is optimistic — it fires the PATCH, swallows
the rejection and sets `readAt` and decrements the total regardless
(`NotificationsProvider.tsx:488-503`). A failed PATCH would then leave an
older-page row locally "read" that the server still counts, the next pass
would skip it, and the badge would stay inflated for the tab's lifetime.
The auto-read pass therefore uses a new `markNotificationsReadConfirmed(ids)`
in `NotificationsProvider` that awaits each PATCH and updates `readAt` and
the local total **only on success**; a failed id stays unread locally and is
retried on the next refresh (idempotent server-side). **Client-only rows**
(`local-*`, which the server does not know and the existing helper already
skips for the PATCH) take a **local-only completion path**: no request, `readAt`
set immediately, and they never touch the server-derived total (§6.3). Test:
a hidden family with one server row and one `local-*` row → exactly one PATCH,
both rows read locally, no retry on the next refresh. No new backend endpoint is required for v1; a
`PATCH …/read?eventTypes=a,b` bulk endpoint is the obvious follow-up in
ORISO-UserService once the volume shows up in SigNoz.

This is exactly what the ✓✓ button does today for _everything_
(`NotificationsProvider.markAllNotificationsAsRead`); the rule applies it to a
subset the user chose. It never touches Matrix read receipts (ADR-AT-01, #1200
JOB1 answer).

**Without auto-read:** hidden families still count in the server-side unread
total, so the nav badge says "12" while the Timeline shows 3 unread. The user
presses ✓✓ to make the number go away and thereby also reads the 3 they wanted.
**With auto-read:** hidden items on loaded pages are already read, so ✓✓ only
has visible items left to clear on those pages (✓✓ itself is unchanged and
still clears everything server-side).

### 6.2 Gespräche and Anfragen

Auto-read is offered in Gespräche as **"Don't count hidden chats as unread"**
and only affects the local unread computation (`isChatItemUnread` consumers and
the nav badge). It **never** sends a Matrix read receipt and never calls the
active-view PATCH: a receipt tells the client "the consultant saw this", which
must stay a deliberate act (privacy boundary in `CONTEXT.md` L53-54 and
ADR-004/005). In Anfragen the option is not shown (§5.3).

### 6.3 Unread badge

There is **no Timeline badge in the navigation rail today**: `NavigationBar`
maps unread indicators only for `/profile` (`NavigationBar.tsx:219-222`) and
does not read `NotificationsContext`; commit `7f6dea17` only drove the
✓✓ button from the server total inside `NotificationsCenter`. This spec
**introduces** the rail badge for `/notifications`. It must be derived in
`NotificationsProvider` (a `visibleUnreadCount` next to the existing
`unreadNotificationCount`) and consumed by `NavigationBar` through the
context, so it updates while `/notifications` is unmounted; the tooltip below
is rendered on the rail item. **Provider order caveat:** `ContextProvider`
(which holds `NotificationsProvider`) is mounted **outside**
`MatrixClientProvider` (`app.tsx:153-156`), so a `useDisplayFilter` hook that
reads the client from `MatrixClientContext` (the `useNotificationSettings`
pattern, `useNotificationSettings.ts:19-28`) would see no client there and the
store would never hydrate from account data on routes without another
consumer. Therefore the **store is attached to the client by a bridge mounted
inside `MatrixClientProvider`** (a `DisplayFilterStoreBridge` next to
`TenantThemingLoader` that calls `displayFilterStore.attachClient(client)`
once the client exists), while `NotificationsProvider` only **subscribes** to
the store (`useSyncExternalStore` needs no client) to compute the count. The
value shows **visible unread**:

- v1 (frontend only). Operands, all from one local snapshot: - `serverTotal` = the **last API `unreadCount`** as received
  (`NotificationsProvider.tsx:324`). This is a **new, server-only**
  field: today's `unreadNotificationCount` is seeded from that value but
  also incremented by every `addEventNotification` (`:441-465`), so
  reusing it and adding local rows again would double-count each local
  event until the next poll (five server unread plus one incoming call
  would read seven). Slice 4 splits the provider state into
  `serverUnreadTotal` (API only) and the local rows' own read state. - `hiddenServerUnreadInLoadedPages` / `visibleServerUnreadInLoadedPages`
  = unread **server** rows in the loaded feed, hidden / visible by the
  effective filter. Client-side `local-*` rows (incoming calls, toasts;
  `:164-173`) are never in the API total and never in these two. - `visibleLocalUnread` = unread local rows the filter shows.

        `visibleUnreadCount = max(serverTotal − hiddenServerUnreadInLoadedPages,

    visibleServerUnreadInLoadedPages) + visibleLocalUnread`.
    The `max`clamp exists because a page-0 refresh replaces`serverTotal` but
    deliberately keeps rows below its reconciliation window (`:191-220`,
    `:310-324`): a read performed on another device lowers the total while
    such a retained older row stays locally unread, so the plain difference
    could drop below what the user can see, or below zero. The clamp keeps
    AC4's lower bound (never less than the visible unread rows on screen);
    the retained rows converge on the next older-page load or reload. This is an
    **upper bound**, never a promise: `apiGetEventNotifications`returns one
    page (50 items) plus a server-wide`unreadCount`, and older pages load only
    on demand, so hidden unread items on unloaded pages stay in the total. With
    auto-read on the bound tightens with every loaded page (hidden items on
    loaded pages are read server-side) but is still only exact once the user
    has paged through all hidden unread. The badge tooltip says "up to N hidden"
    whenever `hiddenServerUnreadInLoadedPages > 0`, i.e. the **server-only**
    bound `serverTotal − hiddenServerUnreadInLoadedPages`is below
   `serverTotal`; neither `visibleLocalUnread`nor the`max`clamp enters
    that comparison (one hidden server row plus one visible local row would
    otherwise make total and badge equal and mute the hint).
    **Reconciliation rule:** both operands come from one local snapshot. The
    auto-read pass goes through`markNotificationsReadConfirmed`(§6.1),
    which on PATCH **success** sets the item's`readAt`**and** decrements the
    local unread total in the same state update, so an item leaves
   `hiddenUnreadInLoadedPages`and`serverTotal`together — never subtracted
    twice. Until the PATCH resolves
    the item stays unread in both operands, so a slow or failed PATCH leaves
    the badge unchanged rather than inflated; the next feed refresh replaces
    the local total with the server's`unreadCount`and recomputes the hidden
    count from the fresh page, which converges both.
    **Refresh-generation guard:**`serverTotal`carries a generation counter
    that every page-0 response increments.`markNotificationsReadConfirmed`     records the generation at PATCH start and, on success, decrements
    `serverTotal`**only if the generation is unchanged**; if a refresh landed
    in between, its`unreadCount`already reflects the server-side read, so
    the completion sets`readAt` and skips the decrement. Without the guard a
    PATCH that commits just before a poll would be subtracted twice (once by
    the poll's total, once by the callback) and the badge would undercount
    visible unloaded events until the next poll. Tests: PATCH success,
    PATCH delayed past a refresh (no double decrement), several PATCHes
    completing around one refresh, PATCH failure.

- v2 (backend, required for an exact badge):
  `GET …/event-notifications/unread-count?excludeEventTypes=` in
  ORISO-UserService, plus `PATCH …/read?eventTypes=` so auto-read covers
  unloaded pages. Filed as a follow-up when v1 lands; AC4/AC5 below state the
  v1 guarantee only.

## 7. Model and persistence

New key in the existing cross-device store (Matrix account data,
`notificationSettings/store.ts`), **separate** from the announcement settings so
a parser bug in one cannot wipe the other:

```ts
// account-data event type: 'org.oriso.display_filters'  (v1)
type Section = 'timeline' | 'sessions' | 'requests';

interface OrisoDisplayFilters {
	version: 1;
	/** Per-section defaults, edited in the profile. Always complete. */
	global: Record<Section, DisplayFilter>;
	/** Optional per-section override, edited in the list popover. */
	sections: Partial<Record<Section, DisplayFilter>>;
}

type KindSetting = {
	/** Rows of this kind appear in the list. `other` is always true. */
	show: boolean;
	/** A chip is rendered while the kind has unread items. Requires show. */
	pill: boolean;
};

interface DisplayFilter {
	/**
	 * Per kind (timeline: EventFamily | 'other'; sessions/requests: §5 ids
	 * | 'other'). A kind missing from the map uses the default
	 * `{ show: true, pill: true }`; `other.show` is forced true on read.
	 */
	kinds: Partial<Record<string, KindSetting>>;
	/**
	 * Timeline only, written by the profile section (#593). Lives in
	 * `global.timeline` ONLY — an override never carries it (§4), so the
	 * profile stays effective while an override exists.
	 */
	hiddenEventTypes?: string[];
	/** §6 — timeline: mark read; sessions: don't count. Ignored for requests. */
	autoReadHidden: boolean;
}
```

- Tolerant parsing exactly like `parseNotificationConfig`: unknown kinds are
  kept (a newer client may know them), unknown keys ignored **for reading**,
  malformed → defaults.
- **Version rule for writing:** if the stored `version` is greater than the
  one this client supports, the store enters **read-only mode** for that
  account-data key — the effective filter is still computed from the known
  fields, but `setGlobal` / `setSection` / reset refuse to write (the
  popover shows "Update the app to change display filters"), so an older
  client never overwrites a newer record with defaults. For the supported
  version, writes **carry unknown top-level keys through unchanged**
  (read → spread → modify known keys → write), never a fresh object.
  Malformed data (unparseable, missing `version`) is treated as absent: it
  reads as defaults and the first write replaces it. Tests: read newer
  version then attempt each write path (no write, UI disabled), read v1 with
  an unknown extra key then write (key preserved), malformed then write
  (replaced). Defaults = `{ kinds: {}, autoReadHidden: false }` (every kind shown with a pill).
- localStorage mirror `oriso.displayFilters.v1` — **inside the `oriso.` app
  namespace on purpose**, so the logout hygiene purges it
  (`clientStorageHygiene` removes keys with the `oriso.` prefix). A key outside
  that prefix would survive logout on a shared agency browser and the next user
  would inherit, and on first attach persist, someone else's hidden kinds.
  (Observation, out of scope here: the existing `ORISO_NOTIFICATION_SETTINGS`
  mirror is outside the prefix and has the same exposure.) Same precedence
  contract as `notificationSettingsStore.attachClient`
  (`notificationSettings/store.ts:193-214`): 1. **Account data is authoritative** whenever it exists. On attach it
  replaces the in-memory state and overwrites the mirror. 2. The mirror is read only **before** a client is attached (pre-login
  shell, Storybook, tests) and as the **seed on first attach** when the
  account has no `org.oriso.display_filters` event yet; the seed is then
  persisted to account data once. **"No event yet" is decided only
  after the client's initial sync has completed — sync state `PREPARED`
  _or_ `SYNCING`** (the repo's own readiness test, `isPreparedSyncState`
  at `matrixClientService.ts:29-31`, and `AuthenticatedApp.tsx:74-79`
  accept both, because Matrix moves from `PREPARED` to `SYNCING` and a
  bridge that attaches after that transition would wait for a state that
  never comes again; the store keeps a monotonic `synced` flag once either
  is seen) — (or after an explicit
  `getAccountDataFromServer`), never from the pre-sync cache: the hook
  attaches as soon as `AuthenticatedApp` publishes the client, but
  `initializeClient` returns right after `startClient`
  (`matrixClientService.ts:204-225`), so a fresh browser would otherwise
  read an empty cache, "seed" defaults and overwrite the account's real
  filters. Until the client is synced the store serves the mirror
  read-only and queues nothing. (Observation, out of scope: `notificationSettingsStore.
attachClient` has the same exposure today.) 3. An update made before attach is written to the mirror only. If account
  data turns out to exist on attach, that pre-sync update is **discarded**
  (account wins, no merge) — same rule as the announcement settings, and
  stated here so nobody expects a merge. 4. Updates after attach write account data first and mirror on success. 5. **Logout / client removal resets the store.** `AuthenticatedApp` publishes `null` as the client on logout (`AuthenticatedApp.tsx:325-331`) after the storage hygiene purged the mirror; the bridge then calls `displayFilterStore.detachClient()`, which drops the in-memory state back to defaults (re-reading the now-empty mirror). Without this, user A's hidden kinds and auto-read would survive in the singleton and, on user B's first attach with no account-data event, be **seeded into B's account** by rule 2. Test: A customises → logout → B attaches with no event → B sees defaults and nothing is written from A's state.
  Tests: attach with account data only, mirror only (first-attach seed), both
  (account wins, mirror overwritten), malformed account blob (defaults, mirror
  ignored), pre-sync update followed by attach with existing account data
  (discarded).
- A `useDisplayFilter(section)` hook returns `{ effective, override, global,
setSection, setGlobal, resetSection }` and re-renders on account-data sync
  (same `useSyncExternalStore` pattern as `useNotificationSettings.ts`).
- Pure helpers in one module (`displayFilter/model.ts`): `resolveEffective`,
  `applyTimelineFilter(items)`, `applySessionsFilter(items)`,
  `applyRequestsFilter(items)`, each with tests. Integration points:
  in `NotificationsCenter` the feed is reduced **once**
  (`visibleFeed = applyTimelineFilter(notificationFeed, effective)`) and that
  same `visibleFeed` is passed to **both** `getFamiliesInFeed` and
  `filterTimelineItems` (today each receives `notificationFeed` separately,
  `NotificationsCenter.tsx:552-568`), so hidden kinds vanish from the chips
  and the rendered list in the same render (AC2);
  `SessionsList.filterSessions` calls `applySessionsFilter` for
  `MY_SESSION` and `applyRequestsFilter` for `ENQUIRY` **after** its own
  consultant/assignment filtering and before `sessionMatchesToolbar`, so the
  chip refinement composes on top (§2).

**Without account data:** the filter would be per browser (like the old
`BROWSER_NOTIFICATIONS` key that caused #1211 root cause B) and a counsellor
using desk and laptop would configure twice and get two different badges.
**With it:** the same mechanism the announcement settings already trust.

## 8. Interaction with what exists

| Existing behaviour                                 | With display filter                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family chips data-driven from the feed             | computed from the **visible** feed → hidden families have no chip                                                                                                               |
| Unread toggle skips auto-read of the selected card | unchanged; auto-read of hidden items is a separate pass and still runs                                                                                                          |
| ✓✓ Mark all as read                                | unchanged: server-side `read-all`, everything, hidden included. Copy stays "Mark all as read". With auto-read on, hidden items on loaded pages are already read before ✓✓ runs. |
| Announcement `families` toggles                    | independent. Hiding a family does **not** mute it; muting does not hide it.                                                                                                     |
| `?chip=` URL mirror in SessionsList                | unchanged; chip composes on top                                                                                                                                                 |
| Profile › Notifications (#593 section)             | becomes the "advanced" view of the same model (per event type)                                                                                                                  |
| Storybook stories for both toolbars                | get a `withDisplayFilter` story each (dot on, popover open)                                                                                                                     |

## 9. Acceptance criteria

- [ ] AC1 All three sections show the filter button at the right end of the chip row; icon-only, dot when customised, keyboard reachable, `aria-expanded`.
- [ ] AC2 Unticking a kind removes those items from the list immediately, on this and (after sync) on a second device.
- [ ] AC3 The popover changes only its own section's override; the other two sections and the profile defaults are unchanged. The profile's "Apply to all sections" touches only `autoReadHidden` and shared kind ids.
- [ ] AC4 Timeline: with auto-read on, hidden unread items **on loaded pages** are marked read server-side within one refresh; the nav badge never shows less than the visible unread count and equals it once all pages with hidden unread are loaded (exact badge = v2 backend follow-up).
- [ ] AC5 Timeline: with auto-read off, the badge shows `serverTotal − hidden unread on loaded pages` (an upper bound) and an "up to N hidden" tooltip when it exceeds the visible count; ✓✓ still clears everything.
- [ ] AC6 Gespräche: an open room stays visible while hidden by the filter (dimmed, tooltip), and disappears after leaving it. No Matrix read receipt is ever sent by the filter (checked with the room's receipt list).
- [ ] AC7 Anfragen: no auto-read option is rendered.
- [ ] AC8 Reset restores the profile default; a malformed account-data blob falls back to defaults without an error boundary.
- [ ] AC9 The new display-filter helpers, persistence and auto-read logic read no message content (metadata only). The existing client-side search over `getSearchText(item)` in `timelineFilter.ts` is unchanged and out of scope for this criterion. Unit tests for `applyTimelineFilter`, `applySessionsFilter`, `resolveEffective`, tolerant parsing, and the five persistence cases in §7.

## 10. Decisions (Frank, 2026-09-14: "take the recommendations")

| #   | Decision                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------- |
| Q1  | Auto-read off by default, one click on in the dialog.                                                           |
| Q2  | The filter never sends Matrix read receipts. Gespräche only adjusts the local count.                            |
| Q3  | A hidden kind has no chip; the dialog is the only un-hide affordance. Chips are additionally user-gated (pill). |
| Q4  | Dialog = families only; per-event-type in the profile.                                                          |
| Q5  | Section override wins over the per-section profile default.                                                     |
| Q6  | #593's profile section becomes the advanced view; reopened as slice 6 if it shipped without UI.                 |
| Q7  | Mobile: same dialog full-screen (M3 dialog handles it); no separate bottom sheet.                               |
| Q8  | Filter (F6) first, then F1/F2. UX first: every UI piece is built and reviewed in Storybook before integration.  |

Additional product input that changed the spec (same conversation):

- Per kind two switches, **Anzeigen** and **Pille** (§3, §5.1, §7).
- **Sonstiges** catch-all, always shown, so the backend stays untouched and
  nothing unmapped can vanish (§3, §5.1).
- The Timeline is a **log**: every event class must be fully suppressible so
  it does not clutter the screen; hiding drafts also removes their pill and
  their history entry from this user's view.
- The filter entry point opens an **M3 dialog**, designed in Storybook first
  so the backend contract follows the finished UX.

## 11. Implementation slices (for the issue) — UX first

1. **Storybook UX (this branch, PR #1378 follow-up):** pure presentational
   components under `src/components/displayFilter/`, no persistence, no
   integration — `FilterChipRow` (the existing chip group extracted into a
   reusable molecule with a story; today it is inline JSX in
   `SessionsListToolbar.tsx` and `NotificationsCenter.tsx`),
   `DisplayFilterButton` (icon-only pill with the "customised" dot),
   `DisplayFilterDialog` (M3 dialog with Show/Pill rows, auto-read switch,
   reset, profile link). Stories for every state (default, customised,
   hidden kind with greyed pill, read-only mode, mobile viewport), unit
   tests, i18n keys de/en. Screenshots under
   `docs/storybook/issue-1377-display-filter/`.
2. **Model + store + hook** (`src/utils/displayFilter/*`, account-data key,
   mirror, synced gate (`PREPARED`/`SYNCING`), version rule, tests). No UI wiring.
3. **Zeitstrahl**: `visibleFeed`, user-gated chips, auto-read pass,
   `visibleUnreadCount` + new rail badge, dialog wired in.
4. **Gespräche**: `classifySession`, pre-filter, keep-paging, active-row
   exception, "don't count", dialog wired in.
5. **Anfragen**: pre-filter + keep-paging + dialog (no auto-read).
6. **Profile**: defaults per section + #593 per-event-type view.
7. **Backend follow-ups** (ORISO-UserService): bulk read by event type;
   unread-count with exclusions.

Each slice is a separate PR with Storybook before/after screenshots.
