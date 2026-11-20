# Event icons and obsolete Storybook examples

Source inspected: `origin/dev` commit
`59d5248824ac62da4771c8173efa91ca6fa59aff`, 2026-10-27.
Links were checked against the deployed Dev Storybook index. This is a source
inventory; it does not claim the proposed icons are approved or deployed.

## Missing mapping

`anonymous.account.deleted` is emitted by
`src/components/sessionHeader/SessionHeaderComponent.tsx` but has no descriptor
in `src/components/notificationsCenter/eventDescriptors/registry.ts`. It falls
back to the generic bell and Other category. The registry-driven All Event Types
story cannot reveal this omission.

All 35 **registered** event types have mappings: 22 glyph identifiers backed by
20 SVG assets. A shared icon is different from a missing mapping.

## Complete registered inventory

Paths below are relative to `src/resources/img/icons/`. Descriptor definitions:
`notificationsCenter/eventDescriptors/registry.ts`; asset selection: `icons.tsx`.

| Event types | Current asset | Review finding |
| --- | --- | --- |
| `inquiry.accepted` | `timeline-case-accepted.svg` | Filled person/check; denial counterpart is outline. Existing story explicitly asserts this shape. |
| `message.new`, `first_response.received`, `conversation.finished` | `speech-bubble.svg` | Filled; no distinct first-response/finished glyph. |
| `thread.reply.new` | `corner-up-left.svg` | Back/reply arrow differs from the established thread glyph. |
| `team.discussion.new` | `speech-bubble-team.svg` | Filled; no verified team-specific outline equivalent found. |
| `supervisor.added`, `supervisor.removed`, `supervisor.assigned` | `timeline-shield-person.svg` | Outline; three states share one icon. |
| `counselor.renamed` | `pen.svg` | Solid pen; no verified canonical outline counterpart found. |
| `request.new` | `timeline-request-client.svg` | Outline question bubble. |
| `request.denied`, `handover.denied`, `case.handover.consent.declined` | `timeline-case-denied.svg` | Outline person/x; intentional reuse documented in source. |
| `waiting_room.client.joined` | `timeline-hourglass-top.svg` | Outline frame with filled sand. |
| `draft.created` | `pen-paper.svg` | Mixed filled pen/outline paper; toolbar uses a dashed bubble. |
| `handover.requested`, `handover.partial`, `handover.all_confirmed`, `handover.auto_confirmed`, `case.handover.consent.requested`, `case.handover.granted`, `case.handover.offer.received` | `case-handover/case-handover.svg` | Seven states share an outline handover icon; current story asserts the approved shape. |
| `call.started`, `appointment.requested` | `timeline-add-call.svg` | Outline phone/plus; deliberate shared mapping. |
| `call.ended` | `call.svg` | Filled handset. |
| `call.missed` | `call-off.svg` | Filled hang-up handset, no missed-call arrow. |
| `call.invited` | `timeline-calendar-add-on.svg` | Outline calendar/plus. |
| `appointment.scheduled` | `timeline-pin-drop.svg` | Location pin; calendar/check would be a more explicit appointment candidate. |
| `appointment.cancelled` | `timeline-event-busy.svg` | Outline calendar/x. |
| `appointment.briefing` | `timeline-schedule.svg` | Outline clock. |
| `group_chat.reminder`, `group_chat.opened`, `group_chat.cancelled` | `chat-booking.svg` | Three states share a filled bubble. |
| `service.notice.planned` | `notification_bell.svg` | Outline bell, also used for generic fallback. |

## Concrete design decisions

1. Reuse `fab-menu-thread.svg` for thread replies. The actual app already uses
   it in ChannelMenu, PanelHeader, ChannelSwitcherFab, MessageItemComponent,
   SessionRailPill and SessionListItemLastMessage.
2. Select a glyph/category for `anonymous.account.deleted` and include this
   runtime event in gallery coverage.
3. Decide whether first response/finished conversation, supervisor changes,
   handover states and group-chat lifecycle states need individual glyphs.
4. Decide the intended message/call/system/appointment toolbar icon family.
   Existing `messages_outline.svg` and `calendar-check.svg` are candidates,
   not approved replacements.

Do not globally remove SVG fill. Some outline icons are filled paths with hollow
geometry. `notificationsCenter.styles.scss` also forces fill onto every path;
that specifically damages the open stroked `corner-up-left.svg` path.

Card glyphs can change after Matrix preview hydration: image/file/audio/video
icons override the event icon, while the detail pane keeps the descriptor glyph.
Account for that behavior during visual comparisons.

## Toolbar kinds

All eight kinds in `src/components/displayFilter/kindOptions.ts` have icons.

| Kind | Asset/style |
| --- | --- |
| Requests | Filled `display-filter-request.svg`; cards use outline question bubble |
| Messages | Filled `speech-bubble.svg` |
| Drafts | Dashed outline `display-filter-draft.svg` |
| Handover | Outline `display-filter-handover.svg` |
| Calls | Filled video camera `display-filter-call.svg` |
| System | Filled exclamation circle `display-filter-system.svg` |
| Appointments | Filled alarm clock `display-filter-appointment.svg` |
| Other | Filled grid/plus `display-filter-other.svg` |

Unread already uses `MarkChatUnreadOutlined`. Family chips do not switch between
selected filled and unselected outline variants; the mixed family is intrinsic.

Review:
[all events](https://dev.oriso.org/storybook-frontend/?path=/story/organisms-notificationscenter--all-event-types),
[handover shapes](https://dev.oriso.org/storybook-frontend/?path=/story/organisms-notificationscenter--handover-event-glyphs),
[first response](https://dev.oriso.org/storybook-frontend/?path=/story/organisms-notificationscenter--structured-first-response),
[icon catalog](https://dev.oriso.org/storybook-frontend/?path=/story/design-system-icons-avatars--catalog).

## Additional obsolete examples — review candidates

The first four components have no production importer, barrel re-export or
dynamic path reference in the inspected source. Stories/tests were excluded
from the reference scan. They are still present in the hosted catalog.

| Example | Evidence and next action |
| --- | --- |
| [Atoms / Tag](https://dev.oriso.org/storybook-frontend/?path=/story/atoms-tag--green) | `tag/Tag.tsx`: unused fixed green/yellow/red labels with hardcoded color; retire from canonical discovery. |
| [Molecules / TagSelect](https://dev.oriso.org/storybook-frontend/?path=/story/molecules-tagselect--default) | `tagSelect/TagSelect.tsx`: unused custom checkbox chips, hidden native input; retire. |
| [Registration / WelcomeScreen](https://dev.oriso.org/storybook-frontend/?path=/story/registration-welcomescreen--default) | `registration/welcomeScreen/WelcomeScreen.tsx`: unused full-page design still described as the registration welcome page; retire. |
| [Registration / RegistrationStepper](https://dev.oriso.org/storybook-frontend/?path=/story/registration-registrationstepper--two-steps-from-agency-link) | `registrationStepper/RegistrationStepper.tsx`: unused; runtime RegistrationHeader uses shared IconStepper and CompactStepRow. Redirect to the current primitives. |
| [Archived breathing tutorial](https://dev.oriso.org/storybook-frontend/?path=/story/components-chat-breathingtutorialcard--inhale) | Already honestly labelled archived/story-only; runtime uses BreathingCompanionHost. Lower priority: exclude archival examples from canonical discovery. |

No `antd` or Ant Design dependency/import was found. These are obsolete custom
patterns; their appearance alone does not prove Ant Design provenance.
Header, Modal, Banner, Box and custom-select infrastructure still have runtime
consumers and must not be removed solely for looking old.
