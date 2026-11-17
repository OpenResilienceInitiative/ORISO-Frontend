# Form kit adoption — before/after

Raw `<select>`, `<option>`, `<textarea>`, `<input type="checkbox|radio">` and MUI
`NativeSelect` replaced by the form kit. Each folder holds `before-*` (origin/dev
at a12d9939a) and `after-*` (this branch) at 390x844 and 1440x900, captured from
a local static Storybook build (`storybook build --test`) with Playwright.
Local proof only, not a hosted deployment.

| Folder                 | Story                                                     | Change                                                                             |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `working-hours`        | Components/Form/Kit adoption → Working hours              | pause checkbox → `M3Checkbox`; label no longer breaks into single letters at 390px |
| `move-proposal-reason` | Components/Form/Kit adoption → Move proposal              | reason textarea → `OrisoTextarea`                                                  |
| `group-chat-roles`     | Components/Form/Kit adoption → Group chat roles           | `NativeSelect` → MUI `Select` + `MenuItem` (kit menu props)                        |
| `breathing-options`    | Components/Form/Kit adoption → Breathing companion        | option checkboxes → `M3Checkbox`                                                   |
| `display-filter`       | Components/Dialog/DisplayFilterDialog → Sessions desktop  | hidden radios → MUI `ToggleButtonGroup` (M3 segmented button)                      |
| `keep-messages`        | Components/Chat/Temporary account → Keep messages desktop | radios → MUI `RadioGroup` + `Radio`                                                |
| `mention-list`         | Components/Composer/MentionList → Mixed membership        | checkboxes → `M3Checkbox`                                                          |
| `notification-config`  | Profile/NotificationConfigDialog → Dialog                 | tone + banner selects → `OrisoSelect`                                              |
| `author-content`       | GroupChat/AuthorContentCard → Two languages               | welcome + rule textareas → `OrisoTextarea`                                         |
