# Test evidence — #1154 slices 13–15 (calls / forms / rescan)

Verified on 2026-08-31, Node 22.12.0, **local only** (no Pre-Dev deploy).

## Targeted

- `npx vitest run --project unit src/components/call/callsFormsI18n.test.ts` → pass (28)
- `npx vitest run --project unit src/i18n.test.ts` → pass (31)
- `npx vitest run --project unit src/utils/callMediaErrorMessage.test.ts` → pass (1)
- `npx vitest run --project unit src/components/profile/ConsultantSpokenLanguages.test.tsx` → pass (2)
- `npx vitest run --project unit src/components/notificationsCenter/ConversationPreview.test.tsx` → pass (8)
- `npx vitest run --project unit src/components/form/OrisoSelect.test.tsx` → pass (3)
- `npx vitest run --project unit src/components/messageSubmitInterface/inputField/EmojiPickerPopup.test.tsx` → pass (1)
- Combined targeted run → 7 files / 74 PASS

## Broader

- `npx eslint --max-warnings=0` on touched TS/TSX → pass
- `npm run lint:scripts` (`eslint src --max-warnings=0 && tsc`) → pass
- `npm run test:unit` → 368 files / **3735 PASS**
- `npm run lint:style` → not run (no SCSS in this slice; already red on pre-dev)
- `npm run build` → not run
- Browser in `fr`/`ru` → NOT RUN

## Red-green

- `callsFormsI18n.test.ts` lists leftover English/German literals in call widgets, form/modal defaults, composer prompts, and rescan extras. Would fail if those strings returned in production files.
- Catalogue asserts cover `calls.*` / `form.dialog.*` in every UI locale; `fr`/`ru`/`ti`/`tr` missing-vs-de stays 0.
- ConversationPreview tests now assert catalogue keys (remaining-chrome dropped English fallbacks).
