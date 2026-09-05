# Supervision parallel panel (WP-B1)

Supervision as a **parallel chat next to the client chat** — not a merged
stream, not a thread. Plan:
`0 - Docs/PLAN-supervision-parallel-panel-2026-09-04.md`. B1 (this
directory's components) is presentational; B2 (below) wires it into
`SessionStream` / `SessionItemComponent`. The only Matrix-aware code in this
directory is the `onSend` prop the owner passes to `SupervisionComposer`.

Storybook: `Components/Session/SupervisionPanel`, `…/SupervisionPanelMini`,
`…/SplitStage`, `…/SupervisionComposer`. Run
`npx vitest run --project storybook src/components/supervisionPanel`; the pure
helpers run with `npm run test:unit -- src/components/supervisionPanel`.

## Components

### `SupervisionPanel`

The expanded side room.

| Prop                         | Meaning                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `counterpartName`            | Person on the other side: the supervisor for a consultant, the responsible consultant for a supervisor. Rendered as "Supervision · {name}". |
| `viewerRole`                 | `'consultant' \| 'supervisor'` — picks the role chip, worded gender-neutrally (`Supervision` / `Beratung`).                                 |
| `unreadCount`                | Badge in the header (unread indicator colour = error role, magenta in this scheme).                                                         |
| `isCollapsed`                | `true` renders nothing; the owner shows `SupervisionPanelMini` instead.                                                                     |
| `onCollapse`, `onClose`      | Header buttons. Without a handler the button stays visible but **disabled** (disable, never hide).                                          |
| `children`                   | Timeline slot (message bubbles). No renderable children → built-in empty state.                                                             |
| `renderComposer`             | Composer slot.                                                                                                                              |
| `frame`, `onFrameChange`     | Floating geometry `{x, y, width, height}`. Set → `position:absolute` in the offset parent, grip moves/resizes. Omitted → fills its parent.  |
| `minWidth`, `minHeight`      | Resize floor (320 × 280).                                                                                                                   |
| `onDragMove`, `onDragResize` | Raw deltas for owners that keep geometry in another shape.                                                                                  |
| `onDragHandleKey`            | Runs before the built-in keys; `preventDefault()` replaces them.                                                                            |

Grip keyboard model: arrow keys move 16 px, Shift + arrow resizes 16 px.
The timeline is `role="log" aria-live="polite"`. The header carries the
"never visible to the client" line permanently.

### `SupervisionPanelMini`

Collapsed miniature. `variant='card'` (desktop: avatar, kind label, name,
one-line snippet, unread badge, pulse on `hasNewMessage`) or `variant='fab'`
(phone: 56 px round button + badge — the mobile switcher). `kind='supervision'
| 'thread'` only swaps icon and label so a thread can reuse it later.

| Prop                           | Meaning                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `name`, `initial`, `avatarUrl` | Identity shown on the card / accessible name of the FAB.                               |
| `unreadCount`, `lastMessage`   | Badge and snippet.                                                                     |
| `hasNewMessage`                | Pulse ring + highlighted border (disabled under `prefers-reduced-motion`).             |
| `onExpand`                     | Click / Enter on the card body or FAB.                                                 |
| `position`, `onPositionChange` | `{right, bottom}` offset from the corner of the positioning parent; owner persists it. |
| `positionMode`                 | `'absolute'` (inside a relative chat container, default) or `'fixed'`.                 |

Card: the grip button is the drag surface (pointer + arrow keys). FAB: the
button itself drags; a press that travels < 6 px counts as a click, a drag
does **not** expand.

### `SplitStage`

Two-pane container. `mode` is forced or derived from `(width < breakpoint)`
(768 px).

| Prop                                            | Meaning                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `main`, `secondary`, `secondaryOpen`            | Panes; `secondaryOpen=false` renders only `main`.                                    |
| `mode`, `activePane`                            | `'split' \| 'single'`; in single mode `activePane` decides which pane is full-width. |
| `secondaryWidth`, `defaultSecondaryWidth` (420) | Controlled / uncontrolled width of the right pane.                                   |
| `onSecondaryWidthChange`                        | Persist the width.                                                                   |
| `minMainWidth` (360), `minSecondaryWidth` (320) | Divider limits.                                                                      |
| `switcher`                                      | Floating node above the stage (a `SupervisionPanelMini`).                            |

Divider: `role="separator"` with `aria-valuenow/min/max`, pointer drag,
arrow keys ±16 px, Home/End.

### `useDragHandle`

Shared hook behind all three: pointer capture drag + arrow-key deltas, a
`consumeDragged()` flag to swallow the click after a drag. Reports deltas,
owns no position.

## i18n

Keys under `supervision.panel.*` in every `src/resources/i18n/*/common.json`
(de, en, fr, ru, ti, tr; `de@informal` only overrides `empty.hint`). Wording
lives in the catalogue, stories assert behaviour, not copy.

## B2 wiring (as shipped on `feat/supervision-parallel-panel`)

Everything below is meant to be ported 1:1 to `dev`. Line numbers are from
the branch at the time of writing; search for the `WP-B2` comment markers
when they drift.

### Files added in this directory

| File                          | Role                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supervisionPanelState.ts`    | Pure state machine (`reduceSupervisionPanel`), unread count, the message-split safety net (`excludeSideRoomMessages`), new-message detection (`findUnseenMessages`), mini snippet, and the storage helpers (collapsed flag per session, width + mini position per user). Unit-tested. |
| `SupervisionComposer.tsx`     | Side-room composer: textarea + send, Enter sends, Shift+Enter breaks the line, failure keeps the text. Transport is the `onSend` prop.                                                                                                                                                |
| `SupervisionPanelContext.tsx` | `{ visible, available, isExpanded, unreadCount, expand }` provided by `SessionItemComponent`, consumed by `SessionMenu` (three components deep — no prop threading through the header).                                                                                               |
| `useBottomNavOffset.ts`       | Phone: measures `.navigation__wrapper` when it is the bottom bar; fallback 72 px (`$grid-base-nine`) + 16 px gap. The FAB's `bottom`.                                                                                                                                                 |
| `SplitStage.tsx`              | Unchanged except `useSplitStageMode` is now exported so the owner knows whether it is on a phone (`single`) or desktop (`split`).                                                                                                                                                     |

### 1. Timeline split — `src/components/session/SessionStream.tsx`

- New state `supervisionMessages` (line ~129). The side room is loaded as
  before (`loadRoomEvents(supervisionRoomId)`), but **no longer merged**:
  `mergeMatrixMessages` is gone from the stream; the client-room list is
  `prepareMessages(applyMessageEdits(formatRoomMessages(clientEvents)))`
  only (line ~430), and the side room becomes its own list (line ~448) with
  `rid = supervisionRoomId` stamped on each item (`formatRoomMessages(…,
stampRoomId = true)`, line ~387). Side-room reactions are not collected at
  all — the panel renders its bubbles without reactions/threads.
- Reset points: curtain (~360), no-Matrix-room fallback (~468), session
  switch cleanup (~1069).
- Passed down as `supervisionMessages={supervisionMessages}` (line ~1250);
  `SessionItemProps.supervisionMessages` in `SessionItemComponent`.
- Timeline listener / history-key requests for both rooms are unchanged
  (the side room still refreshes live).

### 2. Layout + state — `src/components/session/SessionItemComponent.tsx`

- Safety net (line ~1697): `messages` = `excludeSideRoomMessages(props.messages,
supervisionRoomId)` — a side-room item can never reach the client timeline
  even if a caller merges again.
- Supervisor lookup effect (line ~1883) now clears `supervisionRoomId` on
  entry (no lingering room while a new session resolves) and keeps
  `supervisorUsernames` for the counterpart name.
- The whole panel block sits right after `handleCloseThread` (line ~3326):
  eligibility, `useReducer(reduceSupervisionPanel)`, `useSplitStageMode(768)`
  → `supervisionLayout`, the three effects (room resolved/lost, thread
  coexistence, incoming detection), `expand`/`collapse` handlers that also
  persist the per-session flag, unread count, counterpart name, width + mini
  position (localStorage per user), FAB offset, `sendSupervisionMessage`,
  and the context value.
- Render: the former root `<div className="session">` is now `const
sessionCard` (line ~3755). The component returns
  `SupervisionPanelContext.Provider` wrapping either the bare card or, while
  a side room exists, `<SplitStage main={sessionCard} secondary={<SupervisionPanel/>} … />`
  (line ~6059 onwards). CSS hook: `.session__supervisionStage` in
  `session.styles.scss` (line ~208) makes the stage the flex child of
  `.session__wrapper` and aligns the secondary pane with the card's 24 px
  margin on large screens.
- Bubbles: `MessageItemComponent` with `renderMode="main"`,
  `threadsEnabled={false}`, no reply/edit/delete/reaction handlers, the
  session's `e2eeParams` and decryption callbacks reused.
- Composer: `SupervisionComposer` → `chatTransportService.sendTextMessage({
matrixRoomId: supervisionRoomId, supervisorMessage: isSupervisor, … })`
  — the same path the main composer takes (`apiSendMessage` →
  `chatTransportService` → `matrixClientService.sendMessage`), so the SDK
  Megolm-encrypts the send; nothing is bypassed. Plain text, no
  `SUPERVISOR_FEEDBACK_PREFIX`. After a successful send
  `props.refreshMessages()` re-hydrates both rooms.
- Both main-pane composers (thread + main) get `hideSupervisorAudience={hasSupervisionSideRoom}`.

### 3. Who sees it

`isSupervisionPanelViewer = isConsultantUser && !isAskerUser &&
!activeSession.isGroup && !isEmbeddedNotificationsView`. An asker never gets
a stage, a context entry, or a panel, whatever the props contain. `viewerRole`
is `isSupervisor ? 'supervisor' : 'consultant'`. Counterpart name: consultant
→ `getSupervisorDisplayNames(activeSession)[0]` (WP-A list DTO) or the
`supervisorUsername` from `apiGetSessionSupervisors`; supervisor → the
responsible consultant's display name, then username
(`pickSupervisionCounterpartName` in `supervisionCounterpart.ts`, unit-tested).
The consultant session-list DTO carries only `{ id, firstName, lastName }` for
the consultant, so the supervisor view resolves the name by id via
`apiGetConsultant` (public endpoint). Real names are never shown (#996);
until the lookup answers the fallback is `sessionList.user.consultantUnknown`.

### 4. State machine (`supervisionPanelState.ts`)

```
hidden ──ROOM_RESOLVED──▶ expanded            (default on entering a session)
                        ▶ collapsed           (sessionStorage remembers a collapse per session)
expanded ──COLLAPSE (panel X or ⌄)──▶ collapsed      → mini card (desktop) / FAB (phone)
collapsed ──EXPAND (mini, FAB, menu "Supervision")──▶ expanded
collapsed ──INCOMING foreign msg, desktop──▶ expanded  (auto re-open)
collapsed ──INCOMING foreign msg, phone──▶ collapsed + hasNewMessage (FAB pulses, badge)
expanded ──THREAD_OPENED──▶ collapsed (yieldedToThread)
collapsed(yieldedToThread) ──THREAD_CLOSED──▶ expanded
any ──ROOM_LOST──▶ hidden
```

- Close and collapse are one transition: the mini stays as long as the side
  room exists.
- Unread = foreign side-room messages with `messageTime > lastExpandedAt`;
  0 while expanded. Shown on the panel header, the mini card, the FAB and
  as the menu entry's trailing number.
- Incoming detection ignores hydration: the first `supervisionMessages`
  array seeds the known-id set; only later, foreign, newer-than-last-expand
  items dispatch `INCOMING`.
- Thread coexistence rule (simple, documented here): **one side panel at a
  time, the thread wins.** The native thread panel keeps its own position
  (absolute inside the chat card, 520 px); the supervision panel collapses to
  the mini while a thread is open and comes back when the thread closes —
  unless the user collapsed it themselves meanwhile, or a message arrived
  while the thread held the slot (then only the mini pulses).

### 5. Menu — `src/components/sessionMenu/SessionMenu.tsx`

`useSupervisionPanel()` (line ~121). Entry rendered when `visible` (line
~682), **disabled — not hidden — when no side room exists**, title
`supervision.panel.title`, icon `SupervisionIcon`, unread count in the
shortcut slot. Click → `expand()`.

### 6. Main composer — `messageSubmitInterfaceComponent.tsx`

New prop `hideSupervisorAudience` (line ~210). When set and the session is
not a group, options with `kind === 'supervisor'` are filtered out of the
audience selector (line ~2503). Group-chat audiences are untouched;
`asideRouting.ts` stays as the safety net. The supervisor's own main-pane
composer is unchanged (it still routes as an aside to the side room and
shows the "visible only to consultants" note).

### 7. Persistence keys

| Key                                      | Store          | Meaning                               |
| ---------------------------------------- | -------------- | ------------------------------------- |
| `supervisionPanel.collapsed.<sessionId>` | sessionStorage | user collapsed the panel this session |
| `supervisionPanel.width.<userId>`        | localStorage   | secondary pane width (desktop)        |
| `supervisionPanel.mini.<userId>`         | localStorage   | mini card `{right, bottom}`           |

### 8. Phone

`SplitStage` goes `single` below 768 px. `activePane` is `'secondary'`
while expanded (panel full-screen) and `'main'` otherwise; the FAB
(`SupervisionPanelMini variant="fab" positionMode="fixed"`) sits at
`right: 16, bottom: useBottomNavOffset()`. The floating `frame` mode of the
panel is still available but not used by the owner.

### Not done here

- No SessionItemComponent story harness exists, so the wired stage has no
  story; the presentational parts are covered (34 story tests) and the state
  in unit tests. Visual proof happens on pre-dev (WP D).

## Side room system notice (T7, 05.09.2026)

The stage side room (`chatStage/`) opens the supervision timeline with a
system notice in the chat's system-notification bubble:

> Supervision durch {name}. Eine andere Supervisorin oder einen anderen
> Supervisor können Sie über das Plus neben dem Mail-Symbol anfragen.

i18n key `supervision.panel.systemNotice` (de + en), built by
`chatStageFixtures.supervisionSystemNotice()` as a
`[SYSTEM_NOTIFICATION]{"title","description"}` message. It is rendered by
the frontend for now; a server-sent system message with the same payload
(UserService, on assigning the standing supervisor) can replace it 1:1 —
the timeline already renders that format through `MessageItemComponent`.

## Global scope decisions kept (stage v3 fix round, 05.09.2026)

These changes were made for the stage but apply everywhere the organism is
used. They stay on purpose; each is listed so nobody mistakes it for a leak.

| Decision                                                  | Where it applies                                                                  | Value                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile composer one line by default, grows while typing   | every docked composer ≤ 899 px: main chat, thread panel, group chat               | `composerResize.ts` `MIN_HEIGHT_MOBILE = 102` (66 px toolbar strip + 22 px line + 10 px inset + 2 × 2 px border; was 180, then 120 in v3). No 16 px dock inside the card on the phone (`.textarea__inputWrapper` bottom: 0).                                |
| Navigator row (◂ ▬ ▾) is not a fixed element on the phone | same composers                                                                    | rendered only while the composer is focused or has grown beyond one line                                                                                                                                                                                    |
| Timeline content padding under the composer               | `session.styles.scss` (main chat) and `sidePanel.styles.scss` (side room), mobile | 200 px (was 300) — matches the one-line composer                                                                                                                                                                                                            |
| Session list card spacing (Frank's example, T5)           | all lists: enquiries, conversations, team                                         | 24 px between cards, 16 px inside (`sessionsListItem.styles.scss`); ~1 card less per screen than before                                                                                                                                                     |
| Resize handle gestures (T5)                               | list column and side panel                                                        | pill centred on the element height; drag = resize, press-and-hold (450 ms) or double-click = collapse/expand, Up/Down scroll the list. Drag-to-scroll, wheel toggle and hover auto-focus were removed with the scrollbar coupling.                          |
| Header participant stack on the phone (T4)                | every 1:1 session header < 900 px                                                 | one avatar + compact "+N" (`STACK_MAX_VISIBLE_PHONE`); the title truncates with an ellipsis before the call buttons. 40 % of the row for the title is not reachable while the call buttons stay inline — open decision (calls into the kebab on the phone). |

Stage-only (not global): the channel switcher FAB hides while the phone
composer has focus (`chatStage/useComposerFocus.ts`, wired in the stage).

### Added in the stage v6 fix round (05.09.2026)

| Decision                                                                 | Where it applies                                                            | Value                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact action bar starts 4 px from the field edge (T23)                 | every composer: main chat, thread, side room, group chat                    | `composerToolbar--default { padding-left: 4px }` (was 17 px). The desktop has no back arrow, so nothing reserves room for it. Not measured against Figma — Frank decides if 17 comes back.                                                                                                                    |
| Thread entry chip under the root message is visible for every role (T21) | every main-chat timeline with threads, askers included                      | `MessageItemComponent` renders `messageItem__threadButton` ("2 Antworten · Autor: letzte Antwort…"). Before T21 the prop `threadSummary` was never rendered, so this is the first visible thread entry in the bubble timeline. Askers only ever see their own threads — uncritical, but global.               |
| Supervision preview never renders for askers (B2 guard)                  | the channel card (`ChannelMenu`) and the FAB, once wired in `SessionStream` | The card's supervision row shows the last supervision message ("Mona S.: Danke, das hilft…"). B2 must pass the supervision channel only for consultants and supervisors; for askers `channels` carries threads at most. Today this is only a story fixture; the guard is a wiring rule, not a component prop. |
| Composer autofocus yields to focus owners (review v6)                    | every composer (`focusGuards.ts`)                                           | `focusEditorInput` returns when the active element sits in a `[role="menu"]` or a `[data-keeps-focus]` region (the side-panel header). The channel card also re-claims focus while open. Removes the (d3) flake and the focus drop after a FAB pick.                                                          |
| Icon bar: edge fade, snap, mouse-wheel travel (review v6)                | every composer bar (`useScrollableBar`)                                     | `data-overflow-start/end` drive a 24 px mask fade; `scroll-snap-type: x proximity`; a vertical mouse wheel scrolls the bar sideways (trackpad and Shift+wheel stay native).                                                                                                                                   |
| One unread role (review v6)                                              | toolbar badge, channel card badge, FAB badge, panel header badge            | all use `--oriso-unread-indicator-color` (fallback `--m3-error`) — the toolbar badge was `primary` before. Frank may re-map the token later; the four move together.                                                                                                                                          |

### Added in round 4 (05.09.2026, T26–T31)

| Decision                                                                  | Where it applies                                                                | Value                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat menu organism on tokens, Figma hover (T27)                           | every `ChatMenuDropdown`: session list menu, legal links menu, the channel card | `chatMenuDropdown.styles.scss` carries no raw hex any more; hover / focus-visible / selected rows use `--m3-secondary-fixed` (pale blue-grey) with `--m3-primary` label, shortcut and icon — before: a `primary` 8 % pink mix. Eyebrow 14/400 (was 12). Frank asked for the Figma look; the real menu changes with it. |
| Secondary fixed family in the theme engine (T27)                          | `orisoScheme.ts`, static `:root` in `mui-variables-mapping.scss`                | `--m3-secondary-fixed` #dae3f0, `-dim` #bec7d4, `--m3-on-secondary-fixed` #141c25, `-variant` #3f4852 — tones 90/80/10/30 of the secondary palette, locked against the Figma Light table like the primary pair.                                                                                                        |
| Visible avatar at the 16 px inset (T30)                                   | every bubble timeline: main chat, side room, group chat, thread panel           | `messageItem__sideColumn--left/right` margin −6 px = the invisible white ring of the 60 px frame. Timeline padding stays 16 px (Figma 1320:38278).                                                                                                                                                                     |
| Phone composer card corners 4 px, bar at the edge, pill on the edge (T31) | every docked composer ≤ 899 px                                                  | `.textarea__input` radius `0 0 4px 4px` (expanded `16px 0 4px 4px`), `.textarea__figmaToolbar { left: 0 }`, `DragHandle position="edge"` on the phone (prop; desktop keeps `inside`). Assumption: "earlier position" = centred on the card's top edge — Frank confirms or moves it via the prop.                       |
| Channel word names the thread (T26)                                       | `PanelHeader`                                                                   | The line under the hairline is the menu button: "Supervision" / "Thread #n" (number = `numberThreads()`, the card's). `chatStage.panel.thread.subtitle` removed from all locales.                                                                                                                                      |

### Added in round 5 (05.09.2026, T33–T37)

| Decision                                               | Where it applies                                                                                                             | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel card left-aligned with its trigger (T33)       | `PanelHeader` card (`useChannelMenuPlacement`, `channelMenuPlacement.ts`)                                                    | card left edge = channel tag left edge, clamped into the panel (`left` from the pure placement, +4 unit tests); phone unchanged (full width).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| List-to-card gap = Figma 24 px, handle centred (T34)   | the stage (`chatStage.styles.scss`); the app shell keeps its 24 px margin                                                    | Measured in 1320:38278: list items end at x 485, the room's frame starts 24 px later. The stage sets `--pane-inner-gutter: 12px` (the `sessionsList__scrollContainer` desktop margin) beside `--pane-gap: 24px`; the card's left margin is the difference (12 px) and the handle formula in `sessionsList.styles.scss` takes the gutter back — `--pane-inner-gutter` defaults to 0, so `authenticatedApp` is unchanged (its handle still centres in the 24 px margin, 12 px off the visible gap: open follow-up). `STAGE_LAYOUT.LIST_CARD_GAP/LIST_INNER_GUTTER` mirror it. |
| Dual-mode composers rest at one line (T35)             | `MessageSubmitInterfaceComponent` with `compactHeight` — the stage passes it to both desktop composers while a panel is open | `composerResize.ts` `MIN_HEIGHT_COMPACT_DESKTOP = 142` (84 px to the editor + 22 px line + 36 px insets), class `--compact` with the CSS fallback; grows with the content like the phone's 102. Off by default — B2 decides where the app passes it (proposal: whenever `SessionItemComponent` shows a side panel).                                                                                                                                                                                                                                                         |
| Chat text size is one switch (T37)                     | every bubble timeline and every session list row (defaults = today)                                                          | `:root { --message-font-size: 16px; --message-line-height: 21px; --session-preview-font-size: 14px }` in `message.styles.scss`; `.chatStage--compactText` = 14/20/13 for the comparison stories (h1)/(h2). No visible change until a host flips the switch.                                                                                                                                                                                                                                                                                                                 |
| Supervision switch removed from the channel card (T36) | `ChannelMenu`, `PanelHeader`, `ChannelSwitcherFab`                                                                           | Frank's "zu-/abschaltbar" meant the menu opening and closing, not a supervision on/off toggle. The props `supervisionActive` / `onToggleSupervision` and the i18n keys `chatStage.menu.supervisionOn/Off` are gone; the supervision row is a plain `menuitem` again, so `role="menu"` holds nothing but `menuitem`s (review v8). The card keeps its `primary-fixed` tint and the header keeps the chevron trigger.                                                                                                                                                          |

### Added in round 6 + Frank's decisions of 05.09. evening (T39–T41, D1–D11)

| Decision                                                    | Where it applies                                                                                                           | Value                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact chat text is the default (D1, global)               | every bubble timeline, list preview, sender name line, thread entry, composer text — app-wide                              | `mui-variables-mapping.scss`: `--message-font-size: 14px; --message-line-height: 20px; --session-preview-font-size: 12px; --message-name-font-size/-line-height: 14px/20px; --thread-entry-font-size/-line-height: 14px/20px; --composer-font-size: 14px`. The old 16/21 survives only as `.chatStage--legacyText` (story (h1)). Composer minimums follow the 20 px line: phone 100, compact 138, flush 106.                 |
| Menu hover/selected surface = Figma "Hellblau" (D3, global) | `chatMenuDropdown.styles.scss` (every chat/session/channel menu), `sessionsListItem` row menu (carried the raw hex)        | `--oriso-menu-hover-surface: #e7effc` (the value the Figma table files under `on-secondary-container`; the m3Sweep guard forbids `on-*` as a background, hence the alias). Label/icon stay `primary`. `--m3-secondary-fixed` keeps the engine value and is no longer the menu hover.                                                                                                                                         |
| Eyebrow "Weitere Gespräche" (D4)                            | channel card (`chatStage.menu.eyebrow`), de/en/fr/ru/ti/tr                                                                 | one line in the 301 px card.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Old desktop scroll FAB goes (D6)                            | `SessionItemComponent.tsx` `session__scrollToBottom` — app wiring, TODO(B2) left in place                                  | the composer toolbar's `composer-scroll-to-newest` is the one arrow; story (a) asserts no `.session__scrollToBottom` renders.                                                                                                                                                                                                                                                                                                |
| Phone: one back control (D7)                                | `SessionHeaderComponent.hideBackButton`, `PanelHeader.hideBackButton` (both default off; the stage sets them on the phone) | the composer's action bar leads with the back arrow (T16); the header renders none. Stories (e)/(e2)/(e3)/(g) at 390 assert exactly one back control.                                                                                                                                                                                                                                                                        |
| Phone: calls in the kebab menu (D8)                         | `SessionMenu.callsInMenu` (default off), passed through `SessionHeaderComponent.callsInMenu`                               | hides the inline audio/video buttons and renders them as organism rows (`session-menu-start-video-call`, `session-menu-start-call`; the former `false &&` block), same handlers and feature gates. B2 sets it from `untilL`. Story (e) asserts the title keeps ≥ 40 % of the row and both rows sit in the open menu.                                                                                                         |
| List snaps to the icon rail while a panel is open (D10)     | `ConsultantSessionStage.snapList` default `true`                                                                           | (a)/(d) show the rail at 1280 and 1440; (c) is the non-snapping comparison (no toolbar viewport fits the expanded list: 1440 − 420 − 36 = 984 < 2 × 520).                                                                                                                                                                                                                                                                    |
| 24 px list-to-card gap in the app shell (D11, global)       | `authenticatedApp.styles.scss` `.contentWrapper__list` (fromLarge)                                                         | `--pane-inner-gutter: 12px` beside `--pane-gap`; `sessionsListVisualContracts.styles.test.ts` compiles the shell and asserts both.                                                                                                                                                                                                                                                                                           |
| Header rows at the card's top padding (T39)                 | `sessionHeader.styles.scss` / `sidePanel.styles.scss` (unchanged)                                                          | measured: card inner top → header row 16 px → avatar row 22 px in both panes = Figma 1320:38281 (Room Header All y 16, Room Header Content y 6). Nothing between card edge and header in the DOM; story (a) locks both offsets and paddings. The visible "band" above the 32 px call buttons is their centring in the 40 px row — as in Figma.                                                                               |
| Dual-mode composer without outer frame (T40)                | `MessageSubmitInterfaceComponent.flushCorner: 'bottom-left' \| 'bottom-right'` (desktop only, default off)                 | outer shell: no border, radius 0 except the card's outer bottom corner (`--session-card-radius`, new token in `session.styles.scss`, 28 px as before); field: the one bordered box, 4 px corners, fills the former 16 px inset (now at the pane's 16 px dock like the bubbles); drag pill on the field's edge; one line at rest = `MIN_HEIGHT_FLUSH_DESKTOP` 106. The stage passes it for both composers of the joined card. |
| Supervision header + composer accent (T41)                  | `PanelHeader` (`panelHeader--supervision` / `--thread`), `MessageSubmitInterfaceComponent.accent='supervision'`            | supervision: header surface = white + ¼ `primary-fixed` (channel-card recipe), hairline + channel tag `primary-fixed-dim`, composer field border `primary-fixed-dim`; thread: white surface, `primary-fixed` hairline, grey `surface-container-high` tag. Stories (a)/(d)/(d2) assert supervision ≠ thread for all four.                                                                                                     |

### Added in round 7 (05.09.2026, T43–T46 + review-v10 fixes)

| Decision                                                  | Where it applies                                                                               | Value                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header row 4 px tighter at the top than Figma (T43, global) | `sessionHeader.styles.scss` / `sidePanel.styles.scss` `$room-header-gap-top: 2px` (was the 6 px `$room-header-gap`) | **Frank deviates from Figma 1320:38281 by 4 px:** the 32 px call buttons centred in the 40 px row left 4 px of air, so the row's padding-top is 2 instead of 6; the 6 px below the row (to the hairline) stay, so both hairlines still end on the same y (T3). Measured: card inner top → header row 16 px → avatar row 18 px (was 22). Story (a) locks 16/18 and the 2/6 paddings in both panes. |
