# Supervision parallel panel (WP-B1)

Presentational layer for showing supervision as a **parallel chat next to the
client chat** — not a merged stream, not a thread. Plan:
`0 - Docs/PLAN-supervision-parallel-panel-2026-09-04.md`. Nothing in this
directory talks to Matrix or the session state; B2 wires it.

Storybook: `Components/Session/SupervisionPanel`, `…/SupervisionPanelMini`,
`…/SplitStage`. Run `npm run test:storybook -- src/components/supervisionPanel`.

## Components

### `SupervisionPanel`

The expanded side room.

| Prop                         | Meaning                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `counterpartName`            | Person on the other side: the supervisor for a consultant, the responsible consultant for a supervisor. Rendered as "Supervision · {name}". |
| `viewerRole`                 | `'consultant' \| 'supervisor'` — picks the role chip (`Supervisor:in` / `Berater:in`).                                                      |
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

## B2 wiring (port 1:1)

1. **Timeline.** `SessionStream.tsx` already loads the side room
   (`supervisionRoomId`, `loadRoomEvents(supervisionRoomId)`) and merges it
   into the main stream via `mergeMatrixMessages(...)`. Stop merging: keep
   `formatRoomMessages(supervisionEvents, supervisionRoomId)` as its own
   list and render those messages (existing `MessageItemComponent`) as the
   `children` of `SupervisionPanel`. Reactions from the side room go with it.
2. **Composer.** `renderComposer` gets the existing composer bound to the
   side room: `matrixClientService.sendMessage(supervisionRoomId, text,
options)`. The audience selector for supervision (`asideRouting.ts`)
   becomes unnecessary once the composer has one target per pane.
3. **Layout.** Wrap the chat card in `SplitStage` (`main` = today's session
   content, `secondary` = `SupervisionPanel`). Persist `secondaryWidth` and
   the mini `position` per user (local storage is fine).
4. **Open / close state.** `secondaryOpen` = "side room exists AND not closed
   by the user". Auto-open when `supervisionRoomId` resolves; `onClose` sets
   a closed flag; a new side-room event (`m.room.message` in
   `supervisionRoomId` from someone else) clears the flag → re-open, or, if
   the user collapsed, set `hasNewMessage` on the mini.
5. **Menu.** Session header menu entry "Supervision" (`supervision.panel.title`)
   toggles `secondaryOpen`; disabled — not hidden — when no side room exists.
6. **Roles.** `viewerRole` from `isSupervisor` in `SessionItemComponent`;
   `counterpartName` from the supervision DTO (WP-A:
   `supervision.supervisorDisplayNames`) or, for the supervisor, the
   session's consultant display name.
7. **Mobile.** Below 768 px `SplitStage` is single-pane; put
   `<SupervisionPanelMini variant="fab">` in `switcher` while
   `activePane === 'main'`, and route `onClose`/`onCollapse` of the panel back
   to `activePane = 'main'`. Mind the bottom navigation: raise the default
   `bottom` offset by its height.
