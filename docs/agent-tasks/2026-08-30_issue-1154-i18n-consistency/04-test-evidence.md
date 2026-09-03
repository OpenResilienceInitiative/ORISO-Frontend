# Test evidence — #1154 stacked PRs

Verified on 2026-08-30, Node 22.12.0, local only (no Pre-Dev deploy).

## Targeted

- `npx vitest run --project unit src/utils/mergeWeblateCatalogue.test.ts` → pass (4)
- `npx vitest run --project unit src/components/registration/preselectionBox/PreselectedTopic.test.tsx` → pass (1)
- `npx vitest run --project unit src/components/registration/registrationChromeI18n.test.ts` → pass (7)
- `npx vitest run --project unit src/components/registration/accountData/DataProtectionConsentLabel.test.tsx` → pass (13)
- `npx vitest run --project unit src/components/registration/accountData/AccountData.consentGating.test.tsx` → pass (44)
- `npx vitest run --project unit src/components/registration/accountData/AccountData.test.tsx` → pass (7)

## Broader

- `npm run lint:scripts` → pass
- `npm run test:unit` → pass (358 files, 3635 tests)
- `npm run lint:style` → not run (no SCSS in this stack); pre-dev is already red on unrelated SCSS
- `npm run build` → not run (no import/config/type surface change beyond i18n parse helper)
- Browser registration in `fr`/`ru` → NOT RUN (no local frontend session in this turn)

## Red-green

- PreselectedTopic test failed with 0 helper calls before the wiring; passed after.
- `registrationChromeI18n.test.ts` failed 7/7 before removing German `defaultValue`s; passed after.
