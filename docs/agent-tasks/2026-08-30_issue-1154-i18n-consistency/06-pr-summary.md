# PR summary — #1154 slices 13–15 + audit

Parent: [ORISO-Frontend#1154](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154). Stacked PR: [#1243](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1243) on #1242.

## Files changed

Call/form chrome from 080ef0df, plus the 2026-08-31 audit fix: NavigationBar unread aria, waiting mini-game / thread chrome in SessionItemComponent, MessageSubmitErrorBoundary, catalogues, and the source-scan test.

## Test evidence

Local only, Node 22.12.0: `callsFormsI18n` 31 PASS; `i18n.test.ts` 31 PASS; `test:unit` 3738 PASS; `lint:scripts` PASS.

## Screenshots

None — no running frontend this turn.

## Risks / follow-ups

- Still out of repo: API `agency.name` / `topic.name`, ConsultingTypeService `option.label`, Ukrainian UI locale.
- Merge is for senior review. Not merging this stack.
