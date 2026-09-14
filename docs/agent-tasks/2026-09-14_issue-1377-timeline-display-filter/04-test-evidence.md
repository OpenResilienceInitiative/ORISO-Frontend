# 04 — Test evidence (slice 1, 2026-09-14)

Environment: local only (no Pre-Dev). Node 22, `npm ci --ignore-scripts
--legacy-peer-deps` as CI does; the Storybook browser project needs Google
Chrome (`channel: 'chrome'`), locally pointed at the bundled Chromium.

| Check                                                                                                    | Result                                     |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `vitest run --project unit src/components/displayFilter src/components/M3Checkbox src/i18n.test.ts`      | 6 files, 50 tests green (i18n guard incl.) |
| `eslint src/components/displayFilter src/components/M3Checkbox --max-warnings=0`                         | clean                                      |
| `stylelint` on `displayFilter.styles.scss`, `m3Checkbox.styles.scss`                                     | clean                                      |
| `tsc --noEmit` (app) · `tsc --noEmit -p tsconfig.storybook.json`                                         | clean                                      |
| `vitest run --project storybook src/components/displayFilter` (Chromium, axe WCAG 2.2 AA on every story) | 4 files, 16 stories green                  |
| `storybook build`                                                                                        | green                                      |

Screenshots (from the static Storybook build, `docs/storybook/issue-1377-display-filter/`):

| File                                   | Proves                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `01-after-toolbar-default.png`         | Search field + user-gated chips (badges for kinds with unread items) + pinned tune button |
| `02-after-toolbar-system-pill-off.png` | After the play test: System pill switched off → chip gone, dot on the button              |
| `03-after-dialog-customised.png`       | Drafts hidden (pill greyed), System without pill, Sonstiges fixed on, auto-read on        |
| `04-after-dialog-read-only.png`        | Read-only mode: hint, every control inert, reset disabled                                 |
| `05-after-dialog-requests.png`         | Anfragen variant without the auto-read row                                                |
| `06-after-chip-row-with-button.png`    | The extracted chip row molecule with the trailing slot                                    |
| `07-after-chip-row-phone.png`          | 390px: chips scroll under the pinned button                                               |

No "before" shots: the component set is new; the extracted chip row renders
with the unchanged `sessionsListToolbar__chip*` rules (compare
`SessionsListToolbar.stories.tsx`).

Not covered here (later slices): persistence, list integration, rail badge.
