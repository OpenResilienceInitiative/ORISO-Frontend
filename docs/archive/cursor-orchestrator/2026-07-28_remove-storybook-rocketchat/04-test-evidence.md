# Test evidence

## Focused regression

- Red proof: the new Storybook contract failed on the Rocket.Chat README
  wording, DDP implementation, and tracked Storybook backup.
- Green proof: `npm run test:unit -- src/matrixOnlyLegacyArtifacts.test.ts`
  passed all 6 tests after the cleanup.

## Required repository gate

- `npm run test:unit` — passed after review fixes: 216 files, 1,399 tests.
- `npm run lint:scripts` — passed, including TypeScript compilation.
- `npm run lint:style` — passed.
- `npm run build` — passed with existing CRA, Autoprefixer, and bundle-size
  warnings.
- `npm run build-storybook` — passed.
- `git diff --check` — passed.
- Local CodeRabbit review — one valid guard-coverage finding fixed by scanning
  nested Storybook text artifacts and explicit DDP markers.
- GitHub CodeRabbit review — four findings fixed: precise documentation,
  Markdown heading levels, case-insensitive identifier variants, and behavioral
  LiveService mock coverage.
- Final local CodeRabbit review — filename scanning and case-insensitive
  extension coverage fixed; its test-total finding was already satisfied by the
  current 216 / 1,399 evidence.

## Environment

- Dependencies installed with `npm ci --ignore-scripts --legacy-peer-deps`
  because the current Cypress peer range conflicts with React 19 under a plain
  `npm ci`.
- Local runtime was Node 24.15 because Node 22 was unavailable on the machine;
  CI remains the supported-runtime proof.
- No browser check was required because the change only removes dormant
  Storybook mocks and documentation; no product UI behavior changed.
