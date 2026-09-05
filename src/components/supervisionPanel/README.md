# Supervision side channel (WP-B1 → B2)

Supervision as a **parallel chat next to the client chat** — not a merged
stream, not a thread. Plan:
`0 - Docs/PLAN-supervision-parallel-panel-2026-09-04.md`.

Since B2 (05.09.2026) the side room is rendered by the **chat stage
composition** (`src/components/chatStage/`): `SidePanel(PanelHeader,
MessageTimeline, MessageSubmitInterfaceComponent targetRoomId)`, the
`ChannelSwitcherFab` and the `ChannelMenu`. The presentational B1 components
(`SupervisionPanel`, `SupervisionPanelMini`, `SplitStage`,
`SupervisionComposer`, `useDragHandle`, `useBottomNavOffset`, their stories
and `supervisionPanel.styles.scss`) were deleted — the stage stories
(`Templates/ConsultantSessionStage`, `ChatStage.stories.tsx`) are the spec
and the app renders the same DOM / classes.

What is left in this directory:

| File                          | Role                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supervisionPanelState.ts`    | Pure message bookkeeping: unread count (`countUnreadSideRoomMessages`), the client-timeline safety net (`excludeSideRoomMessages`), `findUnseenMessages`. Unit-tested. |
| `supervisionCounterpart.ts`   | Who is on the other side of the side room (supervisor ↔ responsible consultant), never a real name (#996). Unit-tested.                                               |
| `SupervisionPanelContext.tsx` | `{ visible, available, isExpanded, unreadCount, expand }` provided by `SessionItemComponent`, consumed by `SessionMenu` (the "Supervision" entry).                     |

## i18n

`supervision.panel.*` in all six locales (title, systemNotice, composer
placeholder, unread, stage.divider are in use; the B1-only keys stay for
the translators' round-trip and are harmless).

## B2 wiring (as shipped on `feat/supervision-parallel-panel`, 05.09.2026)

Search for the `B2` comment markers in `SessionItemComponent.tsx`.

### 1. One URL parameter is the truth (`src/utils/channelRoute.ts`)

```
/sessions/…/<roomId>/<sessionId>?channel=thread:<rootEventId>[&at=<eventId>]
/sessions/…/<roomId>/<sessionId>?channel=supervision[&at=<eventId>]
```

- `activeThreadRootId` and the open panel are **derived** from
  `parseChannel(location.search)` — no `useState` beside the URL.
- Open = `navigate(push)` (browser Back closes the panel), switch = `replace`,
  close = `replace` without the param (`setChannelRoute`).
- The last open channel is remembered per session in `sessionStorage`
  (`chatStage.lastChannel.<sessionId>`; an explicit close is remembered as
  "closed"). No param on entry → the remembered channel is reopened; nothing
  remembered → the supervision side room auto-opens once (never for askers).
- Legacy `threadRootId` / `threadMessageId`: **hard cut** — mapped once to
  `channel=` / `at=` on entry (`normalizeLegacyChannelSearch`), never written.
  Server action paths that still carry the legacy pair are rewritten at the
  boundary (`rewriteLegacyChannelPath` in `eventDescriptors/registry.ts`,
  `NotificationsCenter.resolveThreadRootId`); the local thread notification
  and the composer's draft `actionPath` write the channel form.
- The session header strips `channel` / `at` from the canonical
  conversation path (activity events).

### 2. Timeline split — `src/components/session/SessionStream.tsx`

Unchanged from B1: the side room is its own list (`supervisionMessages`,
`rid` stamped), never merged into the client timeline;
`excludeSideRoomMessages` stays as the safety net in `SessionItemComponent`.

### 3. Layout — `src/components/session/SessionItemComponent.tsx`

```
.session.chatStage__card(--split)
  > .chatStage__mainPane  (SessionHeaderComponent · session__content/MessageTimeline · composer · ChannelSwitcherFab)
  > .chatStage__panel     (ResizableHandle anchor=start · SidePanel)
```

- Desktop (`fromL`, 900 px): `SidePanel variant="inside"`; both composers
  get `flushCorner` (`bottom-left` main, `bottom-right` panel), the
  supervision composer additionally `accent="supervision"`; `compactHeight`
  is NOT set (checklist 1). Panel width: `clampPanelWidth` against the
  measured card, persisted as `chatStage_panelWidth` (`stageLayout.ts`).
- Phone (`!fromL`): the `SidePanel variant="fullscreen"` replaces the card;
  `SessionHeaderComponent hideBackButton + callsInMenu` and
  `PanelHeader hideBackButton` come from the same `fromL` (checklist 5). The
  main composer's back arrow does the header Link's job: list route +
  `mobileListView()`; the panel composer's back arrow closes the channel.
  The FAB inside the panel is the channel switcher (`onBack` = close).
- List snap (checklist 7): `SessionsListWrapper` derives `panelOpen` from
  the same URL param and `resolveStageLayout` — the list column snaps to the
  80 px rail while a panel is open and dragging it wider is locked.
- Both `session__scrollToBottom` sites are gone (checklist 6); the composer
  toolbar's `composer-scroll-to-newest` is the one arrow.
- Channels (`SecondaryChannel[]`): threads from `computeThreadSummaries`
  (root creation ts, last reply author/preview, per-thread unread from
  `threadUnread.ts`), supervision from `supervisionRoomId` + the side-room
  list (last message, unread). Fed to `PanelHeader`, `ChannelSwitcherFab`.
- Focus: `PanelHeader` keeps `data-keeps-focus`; a pick from the FAB sets
  `autoFocusChannelButton`; the composer's autofocus respects
  `KEEPS_FOCUS_SELECTOR` (`focusGuards.ts`).
- T7: the side room's first item is the frontend-rendered system notice
  (`supervision.panel.systemNotice`), never counted as unread.
- The supervisor's reason / "start chat" hint render as `InfoBanner` in the
  panel (the old `session__supervisionReason` markup is gone).

### 4. Who sees it

`isSupervisionPanelViewer = isConsultantUser && !isAskerUser &&
!activeSession.isGroup && !isEmbeddedNotificationsView` — the supervision
channel is never built for an asker (checklist 9); askers keep threads only.

### 5. Menu — `src/components/sessionMenu/SessionMenu.tsx`

`useSupervisionPanel()`: entry when `visible`, disabled (not hidden) without
a side room, unread count in the shortcut slot, click → opens the
supervision channel (URL). Icon: `supervision_nocirc_400_24px.svg`.

### 6. Composer — `messageSubmitInterfaceComponent.tsx`

`targetRoomId` (side room), `hideSupervisorAudience` on every main-pane
composer while a side room exists, `flushCorner`, `accent`. The side room's
draft is scoped to the side room (`scope:<sideRoomId>|thread:main`) and its
draft `actionPath` carries `?channel=supervision`.

### 7. Persistence keys

| Key                                 | Store          | Meaning                                   |
| ----------------------------------- | -------------- | ----------------------------------------- |
| `chatStage.lastChannel.<sessionId>` | sessionStorage | last open channel per session (or closed) |
| `chatStage_panelWidth`              | localStorage   | side panel width (desktop)                |
| `sessionsList_width`                | localStorage   | list column width (unchanged)             |

### Not done here

- Fetching a thread root that is not in the loaded history (analysis F3):
  the main chat stays open. `at=` is carried, not yet scrolled to.
- List preview prefix "Supervision:" needs `SessionDTO.supervision.sideRoomId`
  (UserService B3); "Thread:" is live (`matrixRoomPreview.ts`).
- `supervision.message.new` events, active-view `sideRoomId`, supervisor
  e-mail deep link: UserService B1/B4/B5.

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

| Decision                                                                       | Where it applies                                                                                                                                                                                                                                                               | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header row 4 px tighter at the top than Figma (T43, global)                    | `sessionHeader.styles.scss` / `sidePanel.styles.scss` `$room-header-gap-top: 2px` (was the 6 px `$room-header-gap`)                                                                                                                                                            | **Frank deviates from Figma 1320:38281 by 4 px:** the 32 px call buttons centred in the 40 px row left 4 px of air, so the row's padding-top is 2 instead of 6; the 6 px below the row (to the hairline) stay, so both hairlines still end on the same y (T3). Measured: card inner top → header row 16 px → avatar row 18 px (was 22). Story (a) locks 16/18 and the 2/6 paddings in both panes.                                                                                                                                                                                                                                      |
| Dual-mode composer: double radius, flush send button, 16 px dock (T44/T45/T46) | `messageSubmitInterface.styles.scss` flush block (`--flush-bottom-left` / `--flush-bottom-right`, desktop only)                                                                                                                                                                | T44: the field's OUTER bottom corner is rounded concentrically inside the card's corner — `calc(var(--session-card-radius) − 16px)` = 12 px; the three other corners stay 4 px. T45: `.textarea__buttons` at `top/right: 0` in flush mode, so the 48 px send button sticks to the field's top-right corner again (the 16 px offset was the old inset). T46: the field ends 16 px before the card edge on its outer side (main column left, panel right) — unchanged since T40, now locked as its own assertion. Stories (a) at 1280 and the new (a-1440) at 1440 (same play, pinned to `innerWidth ≥ 1440`) plus (d) assert all three. |
| Small chat lines = M3 label/medium 12/16 (review v10 D1, global)               | `mui-variables-mapping.scss` `--message-name-*`, `--thread-entry-*` 12/16, new `--session-preview-line-height: 16px` (`sessionsListItem.styles.scss` reads it instead of a hard 20 px); the dead `__username` entry in the 12 px shared block of `message.styles.scss` is gone | The name line was 12/13 before D1 and had grown to 14/20 (= the body); it is now visibly smaller than the 14/20 body again, the thread entry is back to 12/16, the list preview is 12/16 (12/20 is no M3 line). Legacy (h1) keeps 12/13 name, 14/20 preview. Stories (h1)/(h2) assert font-size AND line-height of preview, name and thread entry.                                                                                                                                                                                                                                                                                     |
| Menu hover alias bound to the engine (review v10 D3, global)                   | `mui-variables-mapping.scss` `--oriso-menu-hover-surface: var(--m3-on-secondary-container, #e7effc)`                                                                                                                                                                           | Same rendered value today; a seed swap or the dark scheme now moves the hover with the engine. The m3Sweep guard only inspects background-like properties, so the alias definition passes (unit run: exactly the 3 pre-existing failures).                                                                                                                                                                                                                                                                                                                                                                                             |
| Chat card margin in the app shell (review v10 D11, global)                     | `authenticatedApp.styles.scss`: `--pane-gap` / `--pane-inner-gutter` now on `.contentWrapper` (both columns read them); `.contentWrapper__detail .session, .enquiry__wrapper { margin-left: calc(var(--pane-gap) − var(--pane-inner-gutter)) }` (fromLarge)                    | The stage's `> .session:first-child` rule, now in the app too — the list handle centres in the real 24 px gap instead of sitting 6 px off. `sessionsListVisualContracts.styles.test.ts` compiles the shell and asserts the token pair and the margin rule (and the stage's twin rule).                                                                                                                                                                                                                                                                                                                                                 |
| Second scroll-FAB site marked for B2 (review v10 / D6)                         | `messageSubmitInterfaceComponent.tsx` (`getElementsByClassName('session__scrollToBottom')`, ~1170) carries the same `TODO(B2, D6)` as `SessionItemComponent.tsx`                                                                                                               | Story (a) asserts no `.session__scrollToBottom` renders in EITHER pane; B2 removes both sites together.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Phone kebab call rows are real controls (review v10 D8)                        | `SessionMenu.tsx` `callsInMenu` rows: `<button type="button">` instead of `div onClick` (the organism's `chatMenuDropdown__item` already resets button chrome)                                                                                                                 | Native role button, Tab reaches them, Enter/Space activate, the visible title is the name. A `menuitem` role would need the organism's card to be `role="menu"` (it is `role="dialog"`) — that is the organism-wide keyboard ticket, not touched here. Story (e) asserts both rows are `button[type=button]`, `tabIndex` 0, take focus, have a name.                                                                                                                                                                                                                                                                                   |

**B2 note — phone back navigation (review v10 D7).** The header back the stage hides (`hideBackButton`) was `<Link to={listPath + getSessionListTab()} onClick={mobileListView}>` (`SessionHeaderComponent.tsx`). The composer's `onBack` must therefore do BOTH: the Link navigation to the list route AND `mobileListView()` — otherwise the list stays hidden on the phone. The FAB "×" (`chatStage.switcher.backToMain`) in the phone's secondary view stays as a second way back to the main chat: it is the channel switcher, not a duplicate header back — decided: keep, documented here.
