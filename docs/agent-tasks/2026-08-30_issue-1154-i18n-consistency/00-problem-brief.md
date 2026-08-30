# Problem brief — #1154 i18n consistency (close-out)

- **Source**: [ORISO-Frontend#1154](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154). Stacked PRs #1231–#1242 already in senior review — do not merge.
- **Problem**: After leftover `t()` fallbacks were dropped, call widgets and shared form/modal primitives still render raw English/German chrome (titles, aria-labels, alerts, default props). A full-platform rescan also found the same pattern on call-start alerts, composer prompts, booking iframe titles, and a loading aria-label.
- **Goal**: Advice-seeker and consultant chrome stays in the selected UI locale; missing keys follow `fallbackLng` (`de`), not a hardcoded language.

## Acceptance criteria

- [x] Slice 13+14 (+ rescan extras) on `cursor/1154/calls-forms-i18n` (uncommitted; stacked PR pending ask).
- [x] Source-scan test lists leftover literals and fails if they return.
- [x] New keys exist in `de`/`en`/`fr`/`ru`/`ti`/`tr`; `fr`/`ru`/`ti`/`tr` missing-vs-de budget stays 0; no redundant `de@informal` copies.
- [x] No `t(key, 'DE|EN…')` / `{ defaultValue: '…' }` / `translateWithFallback(..., 'literal')` in production `src/`.
- [x] No raw user-visible DE/EN chrome in production JSX (`button`/`h1–h3`/`title`/`aria-label`/`placeholder`/`alert`/`prompt`).
- [x] `npx vitest` on the slice test + `src/i18n.test.ts` + updated tests; `npm run lint:scripts`; `npm run test:unit`.
- [ ] #1154 comment lists out-of-repo leftovers (agency/topic names, age `option.label`, Ukrainian) as follow-ups. Do not close or merge without asking.

## Assumptions

- Booking iframe `title`s and the Element-URL misconfig alert are in-repo chrome (a11y / `alert()`), so they ship in this stack.
- `*.OLD.tsx` / `*.PROFESSIONAL.tsx` stay untouched (not imported).

## Constraints / non-goals

- Do not merge stacked PRs or close #1154 without asking.
- Do not add `uk/` or retranslate ~3000 keys.
- Agency/topic API names and ConsultingTypeService `option.label` stay out of repo.
- Do not add identical keys to `de@informal`.

## Affected area

`src/components/call/`, `src/components/matrixCall/`, `src/components/videoCall/`, `src/components/form/`, `src/components/modal/OrisoDialog.tsx`, composer/thread defaults, SessionMenu / GroupChatHeader call alerts, catalogues.

## Toolchain

Node **22.12.0** (`~/.nvm/versions/node/v22.12.0/bin`). `npm run test:unit` · `lint:scripts`. `lint:style` already red on pre-dev (untouched SCSS).

## Open questions

None blocking. Ask before closing #1154 or opening/merging the PR.
