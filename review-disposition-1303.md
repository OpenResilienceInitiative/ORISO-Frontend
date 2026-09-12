# PR #1303 current-position review disposition

Audited against the core cut at `06b2746b`. Statuses describe this isolated
repair worktree only; no GitHub thread was mutated.

| Comment | Disposition | Note |
| --- | --- | --- |
| 3936466362 | Superseded | The retired split-stage divider selector is absent from the core cut. |
| 3936466370 | Fixed | Supervisor lookup no longer resets on same-session context identity churn. |
| 3936466379 | Fixed | Lookup state is session-scoped and late responses are cancelled. |
| 3936466385 | Fixed | Supervision menu entry is a native disabled-capable button. |
| 3936466411 | Fixed | List supervision marker has a localized accessible label. |
| 3936466418 | Fixed | Supervisor name flex child can shrink for ellipsis. |
| 3936466432 | Superseded | `SplitStage.stories.tsx` is absent from the core cut. |
| 3936466445 | Superseded | `SplitStage.tsx` is absent from the core cut. |
| 3936466456 | Superseded | `SplitStage.tsx` is absent from the core cut. |
| 3936466465 | Superseded | `SupervisionComposer.tsx` is absent from the core cut. |
| 3936466477 | Superseded | `SupervisionPanel.stories.tsx` is absent from the core cut. |
| 3936466484 | Superseded | `SupervisionPanel.tsx` is absent; the current `SidePanel` scroll issue is fixed separately. |
| 3936466493 | Superseded | `SupervisionPanel.tsx` is absent from the core cut. |
| 3936466505 | Superseded | `SupervisionPanelMini.stories.tsx` is absent from the core cut. |
| 3936466510 | Superseded | `useDragHandle.ts` is absent from the core cut. |
| 3936466514 | Fixed | Added Russian `few`, `many`, and `other` unread plural forms. |
| 3947508709 | Already fixed | Required blank line is present and Stylelint passes. |
| 3947508715 | Fixed | Story stage retains the exact selected secondary thread id. |
| 3947508719 | Fixed | Registry seeding moved to an effect and the room id is exported. |
| 3947508723 | Fixed | Rail comparison uses `STAGE_LAYOUT.RAIL_WIDTH`. |
| 3947508751 | Deferred | Shared unread-pill Sass mixin is maintainability-only and spans three components. |
| 3947508753 | Fixed | Removed the unused `.chatStageCompare` block. |
| 3947508758 | Deferred | Shared composer/header geometry requires a cross-stylesheet token partial; no current functional failure. |
| 3947508763 | Deferred | Test-comment arithmetic only; assertions already derive production constants. |
| 3947508766 | Fixed | Placement re-resolves and observes the current bound targets per measurement. |
| 3947508771 | Fixed | Composer focus initializes from `document.activeElement`. |
| 3947508776 | Fixed | Docked-composer mutation work is coalesced with animation frames. |
| 3947508779 | Fixed | Corrected the documented name typography fallback. |
| 3947508787 | Fixed | Both early Erstantwort variants expose `data-message-id`. |
| 3947508793 | Fixed | Thread button requires an action callback. |
| 3947508809 | Fixed | Escape dismisses participant name tooltips. |
| 3947508811 | Fixed | Mandatory participant labels include German fallbacks. |
| 3947508820 | Fixed | Removed duplicate tooltip announcement while preserving visual text. |
| 3947508827 | Fixed | Self identity retains the internal display name. |
| 3947508839 | Tracked | Existing TODO names the missing UserService list-side-room contract; no new issue was authorized. |
| 3947508847 | Already fixed | Consumer imports the exported `MatrixRoomPreview` type. |
| 3947508853 | Fixed | README fences now declare `text`. |
| 3947508861 | Fixed | README documents current compact desktop composer behavior consistently. |
| 3947508870 | Fixed | Whitespace display names fall back to trimmed usernames. |
| 3947508888 | Fixed | Thread metadata selects the reply with the greatest timestamp. |
| 3947517007 | Fixed | Menu maximum height cannot exceed available space. |
| 3947517014 | Fixed | Disabled channel trigger hands focus to the header. |
| 3947517029 | Already fixed | Current Sass formatting passes Stylelint. |
| 3947517037 | Fixed | Side panel scrolls only on timeline change while already near the bottom. |
| 3947517050 | Fixed | Switcher element is prop-typed; the unsafe `any` cast is removed. |
| 3947517059 | Deferred | Same shared scroll-button extraction as 3947517078/3947517080. |
| 3947517065 | Fixed | Badge assertion is scoped to its rendered button. |
| 3947517078 | Deferred | Shared scroll-button extraction is a contained follow-up refactor. |
| 3947517080 | Deferred | Duplicate of the shared scroll-button extraction finding. |
| 3947517088 | Fixed | Added the documented 4 px inside drag-handle modifier. |
| 3947517091 | Fixed | Toolbar observer includes nested child-list and text changes. |
| 3947517099 | Fixed | Corrected phone composer geometry comment to 100 px. |
| 3947517106 | Fixed | Added nested chat-stage timeline lookup regression. |
| 3947517124 | Fixed | Shared local query extraction is used for notification route parsing. |
| 3947517135 | Fixed | Timeline keys use stable message ids without indexes. |
| 3947517146 | Fixed | Explicit room attribution cannot be overwritten by message spread props. |
| 3947517158 | Fixed | Story fetch mocking moved from render-time state initialization to layout effect. |
| 3947517179 | Fixed | Desktop header no longer overrides the theme surface with hard-coded white. |
| 3947517184 | Fixed | Resize story asserts the exact widened result. |
| 3947517202 | Already fixed | Current calc formatting passes Stylelint. |
| 3947517222 | Fixed | Rail lock now applies only while a side panel is open. |
| 3947517227 | Fixed | Corrected French supervision sentence. |
| 3947517237 | Not applicable | Thread subtitle was deliberately removed from every locale by the current T26 contract. |

Summary: 45 fixed/already fixed, 10 superseded, 1 tracked contract follow-up,
1 not applicable, and 6 bounded maintainability deferrals.
