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

## Slices 4 + 5 — Gespräche and Anfragen integration (2026-09-15)

`src/utils/displayFilter/sessions.ts`: `classifySession(raw, extended,
currentUserId, canSupervise)` in the spec's order (marker-backed
supervision → circle → internal group → live chat → legacy supervision
fallback → one-to-one; both supervision branches only when the viewer can
supervise, so an asker's chats stay one-to-one), `classifyRequest`,
`applySessionsFilter` / `applyRequestsFilter` (active row kept and
reported for dimming). `SessionsList`: the display filter runs after
`filterSessions` and before the toolbar chip; chip counts (`unread` and
the per-kind counts) come from the display-visible rows, so hidden chats
are neither listed nor counted (§6.2); kind chips are user-gated through
`hiddenKindChips` (pill on and unread rows, or active); the future panel
is gated by its show-only kind over the set BEFORE the row filter; the
list keeps paging while the filter hides rows and fewer than 10 are
visible; the route-active row of a hidden kind stays, dimmed, with the
"hidden by your display filter" tooltip. Anfragen uses the `requests`
section (nearby / live chat / Sonstiges), without the auto-read switch.
`SessionsListToolbar`: pinned tune button (`displayFilter` prop) and
`hiddenKindChips`. i18n key `notifications.displayFilter.hiddenActiveRow`
in six locales.

Not in this slice: the Overview dashboard's unread count
(`useConsultantData`) still counts every session; it has no kind context
and is not a list badge (§6.2 names the list consumers and the rail).

| Check                                                                                                                            | Result                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `vitest run --project unit src/utils/displayFilter/sessions.test.ts` (§5.2 order, asker rule, filters)                           | 11 tests green            |
| `vitest run --project unit src/components/sessionsList src/components/sessionsListItem src/utils/displayFilter src/i18n.test.ts` | 36 files, 306 tests green |
| `vitest run --project unit src/components/sessionsList/SessionsListToolbar.test.tsx` (button placement, chip gating)             | 8 tests green             |
| `vitest run --project storybook src/components/sessionsList/SessionsListToolbar.stories.tsx` (Chromium, axe)                     | 18 stories green          |
| `eslint src --max-warnings=0` · `tsc --noEmit` · `tsc --noEmit -p tsconfig.storybook.json` · `stylelint`                         | clean                     |

Screenshots (`docs/storybook/issue-1377-display-filter/`):

| File                                       | Proves                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `13-before-sessions-toolbar.png`           | Before: every kind chip always present, no tune button                                    |
| `13-after-sessions-toolbar.png`            | After (defaults): the row unchanged apart from the pinned button                          |
| `14-after-sessions-toolbar-customised.png` | Circle and Supervision pills off: their chips gone, unread/drafts stay, dot on the button |

## Slice 6 — Profile › Notifications › Display filters (2026-09-15)

`DisplayFilterProfileSection` (mounted in `NotificationSettingsPanel`):
the three per-section DEFAULT tables (`global[section]`, edited through
`useDisplayFilter(section).setGlobal`), the auto-read switch for Zeitstrahl
and Gespräche, the #593 per-event-type view for the Zeitstrahl (grouped by
family from `KNOWN_EVENT_TYPES`, writes `global.timeline.hiddenEventTypes`,
the family row shows "mixed"), a hint while a list runs its own override,
and "apply to other lists" limited to what more than one section can
interpret (§4: `autoReadHidden` → timeline + sessions, `liveChat` →
sessions + requests). The kind table was extracted from the dialog into
`DisplayFilterKindTable` so both edit the same rows; icons and labels moved
to `displayFilter/kindOptions.ts` and are shared by the three lists.
i18n keys `notifications.displayFilter.{profileTitle,profileDescription,
overrideActive,eventTypesTitle,eventTypesDescription,eventTypeShow,
applyToAll,applyToAllDescription}` in six locales.

| Check                                                                                                                                                                             | Result          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `vitest run --project unit src/components/profile/NotificationSettings/DisplayFilterProfileSection.test.tsx` (defaults vs override, event types, apply-to-all, inert before sync) | 5 tests green   |
| `vitest run --project storybook src/components/profile/NotificationSettings/NotificationSettings.stories.tsx` (Chromium, axe)                                                     | 4 stories green |
| `eslint src --max-warnings=0` · `tsc --noEmit` · `tsc --noEmit -p tsconfig.storybook.json` · `stylelint`                                                                          | clean           |

Screenshots (`docs/storybook/issue-1377-display-filter/`):

| File                                   | Proves                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `15-before-profile-notifications.png`  | Before: no display-filter section in the notifications profile                                   |
| `15-after-profile-display-filters.png` | After: defaults per list, "System" mixed after hiding one event type, override hint, event types |

## Slice 7 — backend for an exact badge (2026-09-15)

ORISO-UserService (branch `claude/timeline-analysis-filter-il7z7b`):
`GET /users/event-notifications?excludeEventTypes=a,b` (rows unchanged,
`unreadCount` without those types, `excludedEventTypes` echoed),
`GET …/unread-count?excludeEventTypes=`, `PATCH …/read?eventTypes=a,b`
(bulk read; empty list is 400). Lists capped at 100 × 100 chars.

Frontend: `hiddenTimelineEventTypes(filter)` (every seeded type of a hidden
family plus the profile list, sorted) is sent on every feed request; a
response that echoes exactly that list makes the total **exact**
(`serverUnreadTotalExcludesHidden`): nothing is subtracted and the "up to
N hidden" hint is off. An older server echoes nothing and the v1 upper
bound stays. With auto-read on, one bulk PATCH per filter change covers
unloaded pages; it runs through the pending-read serialisation (responses
park, a success issues the reconciliation fetch), marks the loaded rows of
those types read locally and lowers the total by the reported count; a
404 marks the server as older and the per-id path stays the only one.

| Check                                                                                                                                     | Result                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| UserService `./mvnw -B test -Dtest=EventNotificationControllerTest,EventNotificationServiceTest` · `spotless:apply`                       | 121 tests green (local only) |
| `vitest run --project unit src/globalState/provider src/utils/displayFilter src/api` (exact badge, older server, bulk read, 404 fallback) | see the run below            |
| `eslint src --max-warnings=0` · `tsc --noEmit` · `tsc --noEmit -p tsconfig.storybook.json`                                                | clean                        |

No screenshots: the rail badge renders the same, only its number and hint change.

## Review round — CodeRabbit full-diff review on #1378 (2026-09-15)

Verified against the code and fixed (one commit): per-event-type hiding
limited to seeded types ("Sonstiges" can never be hidden); a rejected
account-data write rolls back to the last confirmed record and sets
`writeFailed`; a newer mirror without an account event stays read-only
(no seed write); a same-user client replacement (token refresh) keeps the
mirror and the state; the store is detached synchronously in the logout
handler; the bulk read parses its JSON and recognises `NO_MATCH`, and a
failed bulk read is not recorded as done; the rail link's accessible name
carries the localised unread count; "apply to other lists" propagates a
default live-chat setting; the hidden active row explains itself in text;
the row lookup and the filter share `sessionPairId`; the list derivations
are memoised; `hiddenKindChips` is typed to kind chips; the sessions
toolbar renders the shared `FilterChipRow` with a group label; the brief's
scope line matches the branch.

Not changed: the wall-clock waits in the provider tests stay real timers
on purpose (the bulk-read race fixed in `ac457b5f` only reproduced with
real timer/promise interleaving).

| Check                                                                                                                  | Result                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `vitest run --project unit` over displayFilter, provider, sessionsList, app, profile, notificationsCenter, `i18n.test` | 66 files / 506 tests green     |
| `vitest run --project storybook` over sessionsList, displayFilter, NotificationsCenter, NotificationSettings, app      | 18 files / 118 tests incl. axe |
| `eslint --max-warnings=0` · `tsc` (app + storybook) · `stylelint` · `prettier --check`                                 | clean                          |
