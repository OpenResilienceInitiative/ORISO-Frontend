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

| File                              | What                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `displayFilterTypes.ts`           | `KindSetting {show, pill}`, `DisplayFilterValue`, `resolveKindSetting`, `setKindSetting`, `visiblePillKinds`, `isDisplayFilterCustomised`; `other` forced shown. |
| `FilterChip.tsx` / `FilterChipRow.tsx` | The chip group extracted from the inline JSX in `SessionsListToolbar` / `NotificationsCenter`, with a pinned trailing slot. Same `sessionsListToolbar__chip*` rules. |
| `DisplayFilterButton.tsx`         | Icon-only `tune` pill with the "customised" dot; `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`.    |
| `DisplayFilterDialog.tsx`         | `M3Dialog` with one row per kind (Show / Pill checkboxes), auto-read switch, reset, profile link, read-only mode. |
| `useDisplayFilterLabels.ts`       | All strings via `t(...)` (no fallbacks); the components never call `t`.                                          |
| `*.stories.tsx`                   | `Molecules/FilterChipRow`, `Molecules/DisplayFilterButton`, `Components/Dialog/DisplayFilterDialog`, `Organisms/DisplayFilterToolbar` with play tests. |
| `*.test.tsx`                      | jsdom unit tests for types, button, chip row, dialog.                                                            |

Shared change: `M3Checkbox` gained `disabled` and `hideLabel` (M3 disabled
state, label kept for assistive tech) — needed for the dialog's table cells.

i18n: `notifications.displayFilter.*` added to de, en, fr, ru, ti, tr (no
informal overlay needed — the German copy carries no pronoun).

Not in this slice (by design, spec §11): persistence, the store's `PREPARED`
gate and version rule, list integration, the rail badge.
