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
