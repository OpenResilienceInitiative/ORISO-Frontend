# Implementation plan — #1154 slices 13–15

- **Objective**: Wire remaining raw call/form chrome (and rescan extras) through catalogues; stacked PR on #1242.
- **Impacted files**: call widgets, MatrixCallView, VideoCall, CallManager, SessionMenu, GroupChatHeader, OrisoDialog, Oriso form primitives, TipTapComposer, EmojiPickerPopup, ThreadListPanel, DepartmentLegalSection, booking iframes, UIVersionToggle, six `common.json`, new `callsFormsI18n.test.ts`.

## Subtasks

| #   | Subtask                                                                 | Files                                                                                                                       | Verify with                                                                | Status |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 13  | Source-scan test for leftover literals (red then green)                 | `src/components/call/callsFormsI18n.test.ts`                                                                                | `npx vitest run --project unit src/components/call/callsFormsI18n.test.ts` | done   |
| 14  | Add `calls.*` / `form.*` (+ reuse composer/thread) to de/en/fr/ru/ti/tr | `src/resources/i18n/*/common.json`                                                                                          | `npx vitest run --project unit src/i18n.test.ts`                           | done   |
| 15  | Wire slice 13 call UI                                                   | FloatingCallWidget, GroupCallWidget, MatrixCallView, VideoCall, CallManager                                                 | slice test + i18n guard                                                    | done   |
| 16  | Wire slice 14 form/modal/composer defaults                              | OrisoDialog, form primitives, TipTap, EmojiPicker, ThreadListPanel                                                          | slice test + touched `*.test.tsx`                                          | done   |
| 17  | Wire rescan extras (slice 15)                                           | SessionMenu, GroupChatHeader, DepartmentLegal, booking titles, UIVersionToggle, NotFound, Header, typing aria, drafts title | slice test                                                                 | done   |
| 18  | Full-platform rescan clean                                              | production `src/**/*.{ts,tsx}`                                                                                              | Audit 2026-08-31: leftovers found then fixed; walk clean                   | done   |
| 19  | Gates                                                                   | —                                                                                                                           | `npm run test:unit` 3738 PASS; `npm run lint:scripts` PASS                 | done   |

## Verification checklist

- [x] Targeted vitest (slice + i18n + updated tests) — 74 PASS
- [x] `npm run lint:scripts`
- [x] `npm run test:unit` — 368 files / 3735 PASS
- [ ] `lint:style` / `build` — skip unless SCSS/imports change (`lint:style` already red on pre-dev)
- [ ] Browser in `fr`/`ru` — NOT RUN (no frontend up)
- [x] Stacked PR #1243 on `cursor/1154/remaining-chrome-i18n`; reviewers BjoernLudwig, shazia-k — audit commit updates the body; do not merge

## Risks

Stacked base is #1242 (still in review). Do not force-push. Do not merge. Informal overlay stays sparse.
