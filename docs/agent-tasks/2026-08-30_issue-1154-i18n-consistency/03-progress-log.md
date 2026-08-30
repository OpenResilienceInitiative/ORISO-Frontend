# Progress log — #1154

### Iteration 0 — setup

- Target: intake + spike + plan; git branch `cursor/1154/weblate-bundle-wins` from `pre-dev` (clean).
- Change: task docs only.
- Verify: n/a

### Iteration 1 — pass

- Target: AC — Weblate overlay cannot replace a complete bundled catalogue key
- Change: `src/utils/mergeWeblateCatalogue.ts` + test; `src/i18n.ts` FetchBackend `parse` uses it. Scan posted on #1154 (comment 5468992934). Sub-issues blocked by PAT; breakdown lives on the parent issue instead.
- Verify: `npx vitest run --project unit src/utils/mergeWeblateCatalogue.test.ts` → 4 PASS; eslint on touched files PASS

### Iteration 2 — pass

- Target: AC — preselected topic uses locale-aware helper
- Change: `PreselectedTopic.tsx` calls `getRegistrationTopicDisplay(topic, i18n.language)`; new render test
- Verify: `npx vitest run --project unit src/components/registration/preselectionBox/PreselectedTopic.test.tsx` → 1 PASS; eslint PASS

### Iteration 3 — pass

- Target: AC — registration chrome no longer passes German `defaultValue`s
- Change: drop German fallbacks from header, stepper, CompactStepRow, zipcode, consent, Registration chips; add `registrationChromeI18n.test.ts`
- Verify: chrome 7 PASS; DataProtectionConsentLabel 13 PASS; AccountData.consentGating 44 PASS; AccountData 7 PASS; eslint PASS

### Finish — pass

- Target: regression + PR prep
- Change: `04-test-evidence.md`, `06-pr-summary.md`, `.learnings/STATE.md`
- Verify: `npm run lint:scripts` PASS; `npm run test:unit` 358 files / 3635 PASS; browser NOT RUN

### Iteration 4 — pass

- Target: remaining signup/profile literals after full-platform rescan
- Change: drop leftover German/English `t()` fallbacks on zipcode, why-local, agency details, password chips, Registration footer; `profile.routes` Overview → `navigation.overview`
- Verify: `registrationChromeI18n.test.ts` 12 PASS; agency i18n 27 PASS; AccountData 7 PASS; eslint PASS
- Scan posted: https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154#issuecomment-5470327924

### Iteration 5 — pass

- Target: leftovers claimed last in-repo slice; full-platform rescan still found 117 `t`/`tr`/`translate` string fallbacks
- Hypothesis: slice 11 only covered the leftover file list, not session header/menu/list, waiting countdown, notifications, legal, handover carousel, or opening-hours weekdays
- Change: stacked branch `cursor/1154/remaining-chrome-i18n`; drop remaining one-language fallbacks; add `sessionList.resizeHandle.*` + `sessionType.team`; source-scan `remainingChromeI18n.test.ts`
- Verify: remainingChrome 23 PASS; countdown 10 PASS; leftovers 8 PASS; i18n guard 31 PASS; LegalLinkModal 5 PASS; LegalPageWrapper 9 PASS
