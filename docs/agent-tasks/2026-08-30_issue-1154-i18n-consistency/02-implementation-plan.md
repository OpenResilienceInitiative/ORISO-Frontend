# Implementation plan — #1154 slices

- **Objective**: Close remaining frontend-owned #1154 gaps as stacked PRs under the parent issue.
- **Impacted files**: `src/i18n.ts`, `src/utils/mergeWeblateCatalogue.ts`, `src/utils/mergeWeblateCatalogue.test.ts`, `PreselectedTopic.tsx` + test, `RegistrationHeader.tsx`, `CompactStepRow.tsx`, `ZipcodeInput.tsx`, `ConsentSentence.tsx`, `DataProtectionConsentLabel.tsx`, plus their tests.

## Subtasks

| #   | Subtask                                             | Files                                                         | Verify with                                                                            | Status                                  |
| --- | --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Publish scan as #1154 comment + sub-issues          | GitHub                                                        | comment URL                                                                            | done (comment only; new issues blocked) |
| 2   | PR1: Weblate merge — bundle wins                    | `mergeWeblateCatalogue.ts`, `i18n.ts`                         | `npx vitest run src/utils/mergeWeblateCatalogue.test.ts`                               | done                                    |
| 3   | PR2: PreselectedTopic locale helper                 | `PreselectedTopic.tsx` + test                                 | `npx vitest run src/components/registration/preselectionBox/PreselectedTopic.test.tsx` | done                                    |
| 4   | PR3: Drop German defaultValues on signup chrome     | header, CompactStepRow, ZipcodeInput, consent                 | targeted vitest + `lint:scripts`                                                       | done                                    |
| 5   | Follow-up only: API age labels; Ukrainian UI locale | —                                                             | —                                                                                      | blocked (out of stack)                  |
| 6   | PR4–11: leftover chrome slices                      | registration → leftovers                                      | per-slice i18n source-scan tests                                                       | done                                    |
| 12  | Remaining `t(key, 'DE/EN')` after leftovers rescan  | session chrome, waiting countdown, notifications, legal, etc. | `npx vitest run src/components/session/remainingChromeI18n.test.ts`                    | done                                    |

## Verification checklist

- [x] Targeted vitest per PR
- [x] `npm run lint:scripts` on each PR
- [x] `npm run test:unit` before declaring the stack done
- [ ] `lint:style` / `build` if imports/styles change — skipped (no SCSS; build not needed)
- [ ] Browser: registration in `fr` and `ru` (when a running frontend is available)

## Risks

GitHub has no nested PRs — parent is #1154; children are stacked PRs (`base` = previous branch). Do not force-push. Weblate-only locales must still load when the bundle is empty.
