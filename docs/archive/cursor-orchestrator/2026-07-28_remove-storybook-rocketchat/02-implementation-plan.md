# Implementation plan

## Objective

Remove the last Rocket.Chat/DDP Storybook artifacts while preserving the
generic LiveService realtime mock.

## Impacted files

- `.storybook/preview.tsx`
- `.storybook/storybookRealtimeMocks.ts`
- `.storybook/preview.tsx.sb7.bak`
- `.storybook/README.md`
- `src/matrixOnlyLegacyArtifacts.test.ts`
- `src/storybookRealtimeMocks.test.ts`

## Subtasks

| #   | Subtask                                                     | Files                                                                                                                      | Verify with                                                  | Status |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| 1   | Add the Storybook Matrix-only regression contract           | `src/matrixOnlyLegacyArtifacts.test.ts`                                                                                    | `npm run test:unit -- src/matrixOnlyLegacyArtifacts.test.ts` | done   |
| 2   | Remove DDP behavior, obsolete endpoint, backup, and wording | `.storybook/preview.tsx`, `.storybook/storybookRealtimeMocks.ts`, `.storybook/preview.tsx.sb7.bak`, `.storybook/README.md` | targeted Vitest and `npm run build-storybook`                | done   |
| 3   | Run the complete frontend hard gate                         | touched scope                                                                                                              | unit, script lint, style lint, build                         | done   |
| 4   | Exercise the preserved LiveService mock behavior            | `.storybook/storybookRealtimeMocks.ts`, `src/storybookRealtimeMocks.test.ts`                                               | focused Vitest and Storybook build                           | done   |

## Verification checklist

- [x] `npm run test:unit`
- [x] `npm run lint:scripts`
- [x] `npm run lint:style`
- [x] `npm run build`
- [x] `npm run build-storybook`
- [x] Browser check: not required; no product UI behavior changes.

## Risks

- A dormant story may still instantiate the generic LiveService WebSocket; its
  constructor/open/close behavior must remain unchanged.
