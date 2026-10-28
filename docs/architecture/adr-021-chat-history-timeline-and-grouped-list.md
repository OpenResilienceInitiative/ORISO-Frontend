# ADR-021: Chat history shows the future through a timeline handle; the list is grouped and the selection ring follows the focus

- Status: Proposed
- Date: 2026-10-28
- Owners: ORISO Frontend (Frank Gerhardt)
- Decision scope: ORISO-Frontend (session list, room header, display settings)
- Related: Figma App.Oriso 316-17441, 8609-31260; commits 76da0d496 (April grouping),
  afa9dc075 (July grouping), f3d563148 (grouping removed); FutureTimelinePanel.tsx;
  FE#781 (omit vs disable menu items); FE#1884 (tracking issue)

## Context

The conversation list only shows the past. Planned 1:1 appointments and self-help
group occurrences (often 10+ per group) are invisible in it; the existing
FutureTimelinePanel is a collapsible strip shown only when group series exist and the
`futureTimeline` chip is on. Separately, the list renders every conversation as a
standalone tile (24px gaps, doubled hairlines), which wastes space and hides which
conversation is open once focus moves to the editor.

## Decision

1. Grouped list: unselected cards flush in one group, single white hairline,
   24px corners only at group ends (incl. the last card, also in short lists); the
   open card leaves the group with 6px. Shared mixins in `_listItemSelection.scss`.
2. The selection ring follows the focus: 2px `--m3-primary-container` only where
   the focus is; otherwise the open card shows 1px `--m3-primary-fixed-dim`.
   2px = 1px border + 1px inset shadow, so no state changes card size.
   Keyboard focus on another card gives that card the 2px ring, inside its group.
3. A vertical `ResizableHandle` (new `orientation` prop, no second handle component)
   below the filter chips reveals the future. Snap points 0 / next item / 50% / 85%;
   it cannot be pulled past the last future item (springs back); resets on reload,
   persists across chat switches. Always visible for now; an empty future shows
   "No upcoming appointments". Hiding it when the active filter has no future item
   is a later experiment.
4. Future items are twin entries (room + occurrence/booking), not moved sessions.
   The session stays where its last interaction puts it; the appointment gets its
   own entry in the future (dev card look, black 1px outline, no message preview).
   Both open the same room; the clicked entry gets the full state, its twin the calm
   1px outline. A past appointment's twin disappears; series get one entry per date.
5. Future cards carry a `SplitButton` (tonal on normal cards, primary on the active
   one) with the modality icon (`modality-audio|chat|video`, `location.svg` as
   on-site placeholder) and the date ("Mo 13. Dez 18:00"); topic tag and postcode
   stay. Its menu is `ChatMenuDropdown`; entries that do not exist yet are disabled
   with "(coming soon)" in the description. The original card of a conversation with
   an upcoming appointment shows a grey clock circle in the avatar stack (click opens
   the room). Inside the room a compact 40px split button with the next appointment
   sits under the header divider (1:1: after `sessionInfo__metaInfo` in
   SessionHeaderComponent; groups: after `sessionInfo__headerWrapper` in
   GroupChatHeader).
6. Menu content. Counsellors/moderators: edit this occurrence (group: disabled, only
   series editing exists; 1:1: "Reschedule" via cal.com), cancel (group:
   `apiSkipChatOccurrence`; 1:1: cal.com), duplicate as single appointment (group,
   moved from the old strip, must not be lost), configure group (route
   `editGroupChat`), set reminder (disabled). Askers: reminder (disabled), cancel
   1:1 (works), cancel group occurrence (disabled). Disabled-vs-omitted is revisited
   against FE#781 before integration.
7. Two scroll models (a: two panes split by the "Jetzt" line at the handle; b: one
   timeline where normal upward scrolling stops at "Jetzt" and only a deliberate
   ~60px pull releases the future) and three "Jetzt" variants (a: hairline with
   pill, b: handle carries "Jetzt" and becomes the divider, c: fixed band with
   arrows) are built side by side in Storybook, switchable in settings, and decided
   after a hands-on test. The marker shows only the word "Jetzt", no time.
   Floating "↑ Jetzt" / "↓ Jetzt" pills (look of
   `composerToolbar__button--scrollToNewest`) appear once the line is scrolled out.
   Filters apply to both directions; the future exists only where future events do.
8. Mapping in the prototype: group occurrences attach to their room
   (`ChatOccurrence.seriesId` → group session → `matrixRoomId`); bookings get a
   `sessionId` field in the mocks. Entries without a mapping show only with no
   active filter. Mocks use the real API format.
9. Display settings live in Matrix account data next to the display filters
   (`org.oriso.display_filters`), section "Anzeige" (`/anzeige`), for askers and
   counsellors: scroll model, date on past items on/off, "show on upcoming
   appointments" (nothing / next / half list / almost all, matching the snap
   points; default is the look into the future in the appointment area), "Jetzt"
   variant (test phase only), date on the topic tag (a: segment on the tag, default;
   b: own row).
10. The old future strip and the `futureTimeline` chip are removed only after the
    prototype is accepted. The productive list stays unchanged until then.

## Process decisions

- `dev` is the source of truth, never `pre-dev`. Conflict order: code on dev, then
  Storybook, then Figma. Deviations are shown before they are touched.
- Work in a worktree of `origin/dev`; one tracking issue, follow-ups as a checklist,
  not as separate tickets.
- All PRs stay drafts and ship together after the joint local Storybook test.
- Build the prototype in Storybook only (PR 2). Reuse existing components
  (`SplitButton`, `ChatMenuDropdown`, `ResizableHandle`, `TopicTag`, the dev card
  look, the composer button look). Nothing is designed from scratch.
- The grouping that commit f3d563148 removed is reimplemented cleanly, not rolled
  back. Card height, text wrapping and icons on dev stay untouched; only outlines,
  radii and gaps change. The Activity Feed is unchanged (separate session); the
  shared mixins are ready for it.

## Out of scope for now

Per-appointment reminders, moving live chat into the future, on-site appointments,
last-message preview on future items (later experiment).

## Consequences

- List items become "room" or "room + appointment"; selection logic must mark the
  clicked entry fully and its twin calmly.
- 1:1 bookings need a session/room reference from the appointment service
  (today `BookingEventsInterface` only has `askerId`) before twins work for real
  data. Without it, a person with two counselling relationships (e.g. family and
  addiction counselling) gets the appointment on the wrong card.
- Card stories inherit the existing a11y gate failures (`role="tab"` with nested
  buttons); fixing that is out of scope.

## Alternatives rejected

- Moving the session itself into the future: it would vanish from "now" while
  people are writing in it.
- Badge only: the future would still be missing from the timeline.
- localStorage for settings: a phone would show defaults after changing them on desktop.
- A second handle component: drift from the sidebar handle's states and keyboard support.
- Rolling back f3d563148: it also contained wanted Selected-design improvements.
