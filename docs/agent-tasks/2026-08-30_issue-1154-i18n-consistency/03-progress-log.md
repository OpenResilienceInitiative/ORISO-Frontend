# Progress log — #1154

### Iteration 0 — setup

- Target: intake + spike + plan; git branch `cursor/1154/weblate-bundle-wins` from `pre-dev` (clean).
- Change: task docs only.
- Verify: n/a

### Iteration 1 — pass

- Target: AC — Weblate overlay cannot replace a complete bundled catalogue key
- Change: `src/utils/mergeWeblateCatalogue.ts` + test; `src/i18n.ts` FetchBackend `parse` uses it. Scan posted on #1154 (comment 5468992934). Sub-issues blocked by PAT; breakdown lives on the parent issue instead.
- Verify: `npx vitest run --project unit src/utils/mergeWeblateCatalogue.test.ts` → 4 PASS; eslint on touched files PASS
