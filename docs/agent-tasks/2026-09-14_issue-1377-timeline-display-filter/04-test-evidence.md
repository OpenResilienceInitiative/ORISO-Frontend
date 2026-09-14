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

Hard gate (AGENTS.md: `npm run test:unit`, `npm run lint:scripts`,
`npm run lint:style`, `npm run build` must pass), run on head `b90f5bc8`:

| Command                | Local result (this container)                                                                                                                                                                                   | CI on the same head                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`    | 450 files / 4752 tests green, 0 failures (448 files in the full run; the run stalled at the end and the two remaining files `composerFileDropPaste.test.ts`, `emojiInsert.test.tsx` were run separately, green) | green — job "lint, type-check, test, build and Docker validation", `.github/actions/node-build` runs exactly `lint:scripts`, `test:unit`, `build`        |
| `npm run lint:scripts` | exit 0 (eslint `src --max-warnings=0` + `tsc`)                                                                                                                                                                  | green (same job)                                                                                                                                         |
| `npm run lint:style`   | exit 0                                                                                                                                                                                                          | n/a (not part of the CI action; local only)                                                                                                              |
| `npm run build`        | **not completed here**: the webpack build ran 3 h at ~190 % CPU / 5.8 GB without producing output and was stopped — a resource limit of this sandbox, not a build error (no diagnostics emitted)                | green (same job, `CI=false npm run build`, 9 min) — https://github.com/OpenResilienceInitiative/ORISO-Frontend/actions/runs/34849690827/job/103994462594 |

Screenshots (from the static Storybook build, `docs/storybook/issue-1377-display-filter/`):

| File                                   | Proves                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `01-after-toolbar-default.png`         | Search field + user-gated chips (badges for kinds with unread items) + pinned tune button                                          |
| `02-after-toolbar-system-pill-off.png` | After the play test: System pill switched off → chip gone, dot on the button                                                       |
| `03-after-dialog-customised.png`       | Drafts hidden (pill greyed), System without pill, Sonstiges fixed on, auto-read on                                                 |
| `04-after-dialog-read-only.png`        | Read-only mode: hint, every control inert, reset disabled                                                                          |
| `05-after-dialog-requests.png`         | Anfragen variant without the auto-read row                                                                                         |
| `06-after-chip-row-with-button.png`    | The extracted chip row molecule with the trailing slot                                                                             |
| `07-after-chip-row-phone.png`          | 390px: chips scroll under the pinned button                                                                                        |
| `08-after-dialog-phone.png`            | 390×844: the dialog fills the viewport (`fullScreen`, Q7)                                                                          |
| `09-before-dialog-landscape.png`       | 844×390, before: the whole sheet scrolled — title and close control gone, actions floating mid-list                                |
| `09-after-dialog-landscape.png`        | 844×390, after: the sheet stays fixed, header and actions on screen, only the body scrolls (`PhoneLandscape` play test asserts it) |

No "before" shots: the component set is new; the extracted chip row renders
with the unchanged `sessionsListToolbar__chip*` rules (compare
`SessionsListToolbar.stories.tsx`).

Not covered here (later slices): persistence, list integration, rail badge.
