# PR summary — #1154 remaining chrome

Parent: [ORISO-Frontend#1154](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154). Leftovers comment: [5470637260](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154#issuecomment-5470637260).

Slice 12 stacked on leftovers (`cursor/1154/leftovers-i18n` / #1241). Leftovers was not the last in-repo slice: a full-platform rescan found 117 `t`/`tr`/`translate` string fallbacks still snapping UI to German or English.

## Files changed

See `git diff --stat cursor/1154/leftovers-i18n`. Session header/menu/list, waiting countdown, notifications, legal, handover carousel, opening-hours weekdays, plus `sessionList.resizeHandle.*` and `sessionType.team` keys.

## Test evidence

Headline (local only, Node 22.12.0): remaining-chrome source scan 23 PASS; waiting countdown 10 PASS; leftovers 8 PASS; i18n catalogue guard 31 PASS; LegalLinkModal 5 PASS; LegalPageWrapper 9 PASS.

## Screenshots

None — no running frontend this turn.

## Risks / follow-ups

- Call widgets and form-primitive aria-labels still have raw English/German (not `t()` fallbacks).
- API `agency.name` / `topic.name`, ConsultingTypeService `option.label`, Ukrainian UI locale stay out of this repo.
- Merge is for senior review. Not merging this stack.
