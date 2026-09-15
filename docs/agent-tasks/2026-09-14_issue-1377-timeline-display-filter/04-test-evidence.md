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

Icons (2026-09-14, late): the kind icons are Frank's `display-filter-*.svg`
set from issue #1377 (GitHub strips the file names, so the mapping below is by
shape and awaits his confirmation): `request` (bubble with "?"), `draft`
(dashed bubble), `handover` (person with arrow), `call` (camera), `system`
(exclamation), `appointment` (alarm clock), `other` (shapes with "+");
"Nachrichten" keeps the rail's speech bubble. Shots 01–07 were re-taken after
the swap; the unit and Storybook runs above were repeated and stayed green
(4 files / 18 unit tests, 4 files / 20 stories).

No "before" shots: the component set is new; the extracted chip row renders
with the unchanged `sessionsListToolbar__chip*` rules (compare
`SessionsListToolbar.stories.tsx`).

Not covered here (later slices): persistence, list integration, rail badge.

## Slice 2 — model, store, hook (2026-09-15)

Pure logic, no UI: `src/utils/displayFilter/model.ts` (record, tolerant
parse, `resolveEffective`, immutable writers), `src/utils/displayFilter/store.ts`
(account-data key `org.oriso.display_filters`, user-scoped mirror
`oriso.displayFilters.v1.<userId>`, synced gate on `PREPARED`/`SYNCING`,
version rule, serialised writes with revision + attachment generation,
detach hygiene, `storage`-event follow), `src/hooks/useDisplayFilter.ts`
(`useDisplayFilterStoreBinding` mounted once in `AuthenticatedApp`,
`useDisplayFilter(section)` for readers).

| Check                                                                                             | Result                  |
| ------------------------------------------------------------------------------------------------- | ----------------------- |
| `vitest run --project unit src/utils/displayFilter` (spec §7 rules 1–5, version rule, §4)         | 2 files, 23 tests green |
| `vitest run --project unit src/components/displayFilter src/utils/displayFilter src/i18n.test.ts` | 7 files, 78 tests green |
| `eslint` on the new files + `AuthenticatedApp.tsx` (`--max-warnings=0`)                           | clean                   |
| `tsc --noEmit` (app) · `tsc --noEmit -p tsconfig.storybook.json`                                  | clean                   |

No screenshots: nothing renders differently yet (slice 3 wires the lists).

## Slice 3 — Zeitstrahl integration (2026-09-15)

`NotificationsProvider`: numbered feed requests with per-page floors and a
read-settled floor, pending-read parking, `markNotificationsReadConfirmed`
(confirmed-success only, chunks of 50, local rows locally), the auto-read
pass (debounced, skips pending and cooled-down ids), `serverUnreadTotal`
(API only) and the §6.3 badge (`visibleUnreadCount`,
`hiddenUnreadInLoadedPages`). `NotificationsCenter`: `visibleFeed` reduced
once and shared by chips and list, user-gated chips through
`FilterChipRow`/`FilterChip`, the tune button and dialog wired to the store,
keep-paging while fewer than 10 visible rows exist, unseeded event types as
"Sonstiges". `NavigationBar`: badge on `/notifications` with the "up to N
hidden" tooltip. i18n key `notifications.displayFilter.badgeHiddenHint` in
de/en/fr/ru/ti/tr.

| Check                                                                                                                                                                                                                        | Result                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `vitest run --project unit src/utils/displayFilter/timeline.test.ts` (kinds, badge formula, auto-read ids)                                                                                                                   | 8 tests green             |
| `vitest run --project unit src/globalState/provider` (incl. `NotificationsProvider.displayFilter.test.tsx`: §6.1 auto-read, parking + reconciliation, persistent failure, mixed batch, out-of-order polls, older-page total) | 3 files, 14 tests green   |
| `vitest run --project unit src/components/notificationsCenter src/components/app src/components/displayFilter src/utils/displayFilter src/hooks`                                                                             | 39 files, 237 tests green |
| `vitest run --project storybook src/components/notificationsCenter/NotificationsCenter.stories.tsx src/components/displayFilter` (Chromium, axe)                                                                             | 5 files, 26 stories green |
| `eslint src --max-warnings=0` · `tsc --noEmit` · `tsc --noEmit -p tsconfig.storybook.json`                                                                                                                                   | clean                     |

Screenshots (`docs/storybook/issue-1377-display-filter/`):

| File                               | Proves                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `10-before-timeline-filled.png`    | Before: one chip per family present, System chip although the user may not want it, no tune button |
| `10-after-timeline-filled.png`     | After (defaults): chips only for kinds with unread items, tune button pinned at the right          |
| `11-after-timeline-customised.png` | Drafts hidden, System without pill: no draft card, no System chip, dot on the button               |
| `12-after-timeline-dialog.png`     | The dialog opened from the Zeitstrahl, live against the store (reset removes the override)         |
