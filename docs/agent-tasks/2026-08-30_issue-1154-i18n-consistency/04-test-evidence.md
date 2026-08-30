# Test evidence — #1154 remaining chrome

Verified on 2026-08-31, Node 22.12.0, local only (no Pre-Dev deploy).

## Targeted

- `npx vitest run --project unit src/components/session/remainingChromeI18n.test.ts` → pass (23)
- `npx vitest run --project unit src/components/groupChat/waitingClock/WaitingAreaCountdown.test.tsx` → pass (10)
- `npx vitest run --project unit src/components/accountInvite/leftoversI18n.test.ts` → pass (8)
- `npx vitest run --project unit src/i18n.test.ts` → pass (31)
- `npx vitest run --project unit src/components/legalLinks/LegalLinkModal.test.tsx` → pass (5)
- `npx vitest run --project unit src/components/legalPageWrapper/LegalPageWrapper.test.tsx` → pass (9)
- `npx vitest run --project unit src/utils/openingHours.test.ts` → pass (6)

## Broader

- `npx eslint --max-warnings=0` on touched TS/TSX → pass
- `npm run test:unit` → not re-run this slice (narrow gate used)
- `npm run lint:style` → not run (no SCSS)
- `npm run build` → not run
- Browser in `fr`/`ru` → NOT RUN

## Red-green

- Source scan `remainingChromeI18n.test.ts` would fail if any listed German/English `t()` fallback returned.
- Waiting-area tests now resolve `de@informal` over `de` instead of depending on hardcoded informal fallbacks.
