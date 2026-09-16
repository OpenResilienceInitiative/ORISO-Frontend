# 03 — Progress log

## 2026-09-14 — analysis + spec (PR #1378)

- Analysis and spec written; 30 bot review threads (CodeRabbit, Codex)
  addressed in nine commits, every one verified against `dev` first.
- Frank: "take the recommendations for Q1–Q8, start slice 1, UX first in
  Storybook" plus the Show/Pill + Sonstiges model → spec §3/§5/§7/§10/§11
  rewritten, issue #1377 updated.

## 2026-09-14 — slice 1: Storybook UX (same branch, PR #1378)

New folder `src/components/displayFilter/` — presentational only, no store,
no list integration:

| File                                   | What                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayFilterTypes.ts`                | `KindSetting {show, pill}`, `DisplayFilterValue`, `resolveKindSetting`, `setKindSetting`, `visiblePillKinds`, `isDisplayFilterCustomised`; `other` forced shown.     |
| `FilterChip.tsx` / `FilterChipRow.tsx` | The chip group extracted from the inline JSX in `SessionsListToolbar` / `NotificationsCenter`, with a pinned trailing slot. Same `sessionsListToolbar__chip*` rules. |
| `DisplayFilterButton.tsx`              | Icon-only `tune` pill with the "customised" dot; `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`.                                                         |
| `DisplayFilterDialog.tsx`              | `M3Dialog` with one row per kind (Show / Pill checkboxes), auto-read switch, reset, profile link, read-only mode.                                                    |
| `useDisplayFilterLabels.ts`            | All strings via `t(...)` (no fallbacks); the components never call `t`.                                                                                              |
| `*.stories.tsx`                        | `Molecules/FilterChipRow`, `Molecules/DisplayFilterButton`, `Components/Dialog/DisplayFilterDialog`, `Organisms/DisplayFilterToolbar` with play tests.               |
| `*.test.tsx`                           | jsdom unit tests for types, button, chip row, dialog.                                                                                                                |

Shared change: `M3Checkbox` gained `disabled` and `hideLabel` (M3 disabled
state, label kept for assistive tech) — needed for the dialog's table cells.

i18n: `notifications.displayFilter.*` added to de, en, fr, ru, ti, tr (no
informal overlay needed — the German copy carries no pronoun).

Not in this slice (by design, spec §11): persistence, the store's `PREPARED`
gate and version rule, list integration, the rail badge.

## 2026-09-16 — chip menu, pill semantics, Träger switch (Frank's review of the dev build)

Frank's findings on `dev.oriso.org` (Safari, ~700 px window): after
un-ticking and re-ticking "Mail" in the Anfragen filter the Mail chip never
came back; "Sonstiges" looked like an empty row (it was below the fold of the
scrolling dialog body). Decisions taken with Frank (AskUserQuestion, this
session):

1. **Pille = the chip is a menu entry.** A chip renders for every shown kind
   whose pill is on; unread items are its badge. Replaces §5.1 "chip only
   while unread" and §3 "pill rendered only while the kind has unread items".
2. **Hide → show keeps the pill intent.** `setKindSetting` no longer
   overwrites `pill` on hide; `resolveKindSetting` masks it while hidden,
   `parseKindSetting` keeps the stored intent.
3. **Chip view + auto-sort are user settings** on the section filter
   (`view: 'icons' | 'text'`, `autoSort: boolean`, defaults icons + on):
   icon pills that expand when active (Figma 1139:45736) or compact 28 px
   text pills (Figma 9947:31377); auto-sort floats kinds with unread items to
   the left, stable otherwise. Edited in the dialog (segmented radio + switch).
4. **Träger feature switch → kind availability** (`available` /
   `deactivated` / `absent`): a format switched off in the Admin panel while
   rows of that kind still exist stays listed with a locked chip and locked
   dialog row plus hint; its chip click opens an `M3Snackbar` (`role=status`)
   with `notifications.displayFilter.deactivatedNotice`. With no rows the
   kind is not listed. Applies to `circle` (`featureGroupChatV2Enabled` /
   `featureSelfHelpGroupsEnabled`) and `internalGroup`
   (`featureSupervisionEnabled` / `featureInternalGroupChatEnabled`); live
   chat and supervision stay role/availability gates, not Träger switches.

Research behind item 4 (two Explore passes over Frontend, Admin,
TenantService, AgencyService, UserService, Docs): switching a feature off is
never blocked and never cleans up anywhere in the platform; UserService gates
only `createChatV2` (403) and per-attempt calls; existing rooms stay fully
usable; the frontend only hid chips and create entries. Follow-ups that are
**not** in this branch: the room-level notice for consultants and askers when
they open a deactivated room (composer read-only + banner, ADR needed for the
cascade platform → Träger → Beratungsstelle, which no ADR documents — both
appliers cite a non-existent "ADR-013 P4"), agency-level effective settings
in the App layer, and the registration-side agency filter by modality
(ADR-001 is still Proposed).

Code: `displayFilterTypes.ts` (`orderChipKinds`, `resolveChipPresentation`,
`resolveKindAvailability`, `listedKinds`), `model.ts` (presentation fields),
`FilterChip.tsx` (`view`, `deactivated`), new `FilterChipMenu.tsx` + stories,
`DisplayFilterDialog.tsx` / `DisplayFilterKindTable.tsx`,
`SessionsListToolbar.tsx` (shared chip, new props), `SessionsList.tsx`
(`rowsByKind`, availability, snackbar), `NotificationsCenter.tsx` (view,
order). Dialog rows 48 → 40 px so the dialog fits 700 px with the new
controls. TDD red → green per slice; Storybook play tests green (55),
`test:unit` green.
