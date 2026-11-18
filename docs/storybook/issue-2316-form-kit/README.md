# Form kit adoption — before/after

Raw `<select>`, `<option>`, `<textarea>`, `<input type="checkbox|radio">` and MUI
`NativeSelect` replaced by the form kit. Each folder holds `before-*` (origin/dev
at a12d9939a) and `after-*` (this branch) at 390x844 and 1440x900, captured from
a local static Storybook build (`storybook build --test`) with Playwright.
Local proof only, not a hosted deployment.

**Where the `before-*` captures come from.** The four
`Components/Form/Kit adoption` stories are new in this branch. They were
written first, then one static Storybook was built with that story file on
top of unchanged `a12d9939a` components (no component edits yet) and
captured as `before-*`; the components were changed afterwards and the same
stories captured as `after-*`. All other rows use stories that already exist
on `a12d9939a`, rendered unchanged. `display-filter` is scrolled to the view
switch (`[data-cy="display-filter-view"]`) before capture.

| Folder                    | Story                                                                 | Change                                                                                                      |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `working-hours`           | Components/Form/Kit adoption → Working hours — pause checkbox per day | pause checkbox → `M3Checkbox`; at 390px the times move under the day name instead of running off the dialog |
| `move-proposal-reason`    | Components/Form/Kit adoption → Move proposal — reason field           | reason textarea → `OrisoTextarea`                                                                           |
| `group-chat-roles`        | Components/Form/Kit adoption → Group chat — role per participant      | `NativeSelect` → MUI `Select` + `MenuItem` (kit menu props)                                                 |
| `breathing-options`       | Components/Form/Kit adoption → Breathing companion — sound options    | option checkboxes → `M3Checkbox`                                                                            |
| `display-filter`          | Components/Dialog/DisplayFilterDialog → Sessions desktop              | hidden radios → MUI `ToggleButtonGroup` (M3 segmented button)                                               |
| `keep-messages`           | Components/Chat/Temporary account → Keep messages desktop             | radios → MUI `RadioGroup` + `Radio`                                                                         |
| `mention-list`            | Components/Composer/MentionList → Mixed membership                    | checkboxes → `M3Checkbox`                                                                                   |
| `notification-config`     | Profile/NotificationConfigDialog → Dialog                             | tone + banner selects → `OrisoSelect`                                                                       |
| `author-content`          | GroupChat/AuthorContentCard → Two languages                           | welcome + rule textareas → `OrisoTextarea`                                                                  |
| `display-filter-timeline` | Components/Dialog/DisplayFilterDialog → Timeline desktop              | phone: kinds drawn as hairline rows instead of light tinted cards                                           |
