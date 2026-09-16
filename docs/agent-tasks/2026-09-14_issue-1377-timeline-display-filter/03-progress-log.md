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

### 2026-09-16, second round (Frank's review of the pre-dev build)

- **Three chip views**, not two: `icons` (only the active pill shows its
  label), `labels` (icon + label on every pill), `text` (compact text pills).
  In the text view the Create and Archive links are text pills too, so no
  large icon sits next to small text.
- **Column wording**: "Anzeigen" → **"In der Liste"**, "Pille" → **"Als
  Pille"** (Frank: the old word did not say what happens).
- **Sonstiges bundles**: a shown kind whose pill is off travels with the
  Sonstiges chip — its unread items count there
  (`visiblePillKinds` adds them), the Sonstiges chip filters to those rows
  (`matchesOtherChip`; Zeitstrahl via `TimelineFilterState.bundledUnderOther`,
  Gespräche/Anfragen via the new `other` toolbar chip). Nothing leaves the
  chip row silently any more.
- Pre-dev: two containerd instances on the host; only `k3s ctr -n k8s.io
  images import` reaches the cluster store (see memory note). Storybook of
  the branch runs on `https://predev.oriso.org/storybook-frontend/`.

### 2026-09-16, third round (Frank's review of the pre-dev Storybook)

- **Bundle chip is "Weitere"** (dialog row stays "Sonstiges" for unmapped
  events) and appears **only** while a kind is bundled or unmapped items are
  unread — all pills on ⇒ no extra chip.
- **One footer line**: "Diese Liste weicht von deinen Standards ab ·
  Zurücksetzen" while an override exists, plus "Standards bearbeiten"
  (profile). "Fertig" is the only dialog action; the separate reset button
  is gone.
- **"Ton" replaces "In der Liste" in Gespräche and Anfragen** (`columns`
  prop, `SESSION_COLUMNS`): a kind can be muted (`KindSetting.sound === false`)
  on top of the area sound settings. `SessionsList` publishes session → kind
  into `sessionKindRegistry`; `NotificationsProvider.maybePlaySoundForNewEvent`
  skips the sound when `isEventMutedByKind` says so. The Zeitstrahl keeps
  hiding ("In der Liste"). Per-session fine-tuning is the next stage, not in
  this branch.
- Column wording: "In der Liste" / "Als Pille" / "Ton".

### 2026-09-16, fourth round (Frank's review of the design canvas)

- **Filter button lives in the search field** (leading slot, where the
  functionless kebab sat), in Gespräche, Anfragen and the Zeitstrahl
  (`ListSearchField.leading`); the chip row has no trailing button any more.
  While the search panel is open the slot shows the close button as before.
- **Text view is denser**: 4 px gap, 28 px pills with 10 px padding, filter
  button as a bare glyph (`DisplayFilterButton.compact`).
- **Dialog hero icon = the list's icon** (`DisplayFilterDialog.icon`: inbox,
  chats, activity).
- **Future timeline panel keeps a switch** in sound mode (`In der Liste:
  Zukünftige Termine`), the table row is gone.
- Pill column caption is **"Anzeigen"** (Frank), show column stays "In der
  Liste" (Zeitstrahl only).
- **Sound choice per kind** (Frank: "den Ton auswählen, nicht nur an/aus"):
  two proposals on the design canvas — A: small split button per row
  (preview + menu), B: on/off per row + one tone select for the list. Not
  implemented yet; waiting for Frank's pick. Today `KindSetting.sound` is a
  boolean mute; A would turn it into a `SoundId | false`.

### 2026-09-16, fifth round (Frank picked proposal A)

- **Tone per kind** in Gespräche/Anfragen: `KindOptionPicker` (the
  `SplitButton` in a new `size="small"` 32 px form + MUI menu) — main
  segment previews the tone, arrow opens the menu: area default, ring tone,
  Ton 1–12, muted. `KindSetting.sound` is a `SoundId` now (`'none'` = muted;
  legacy boolean `false` parses to `'none'`). `NotificationsProvider` passes
  `soundOverrideForEvent` into `playNotificationSound(…, override)`.
- **Live-chat pill modes** (same picker in the Anzeigen column): dynamic
  (follows availability, default), pinned (`KindSetting.fixed`), off. Live
  chat is always listed now; the toolbar shows the chip when available OR
  pinned.
- **Archiv** is a pill-only kind in Gespräche whose pill drives the Archiv
  link (`showArchiveChip`); **Termine** is a greyed placeholder row
  ("Kommt bald.").
- **Wording**: button "Ansicht einstellen" / "Ansicht angepasst", dialog
  title "Ansicht · <Liste>", description mentions tones. The button in the
  search field shows the list's own icon (inbox / chats / activity).
- All pickers in a column share one width (128 px) and truncate.
- Separate branch by a sub-agent: `fix/live-chat-active-session-lost`
  (route-active row survives the chip axis; live-chat chip visible while a
  live chat is open) — see its commit message; the rail button's toggle vs.
  navigate behaviour is left as a product decision.
