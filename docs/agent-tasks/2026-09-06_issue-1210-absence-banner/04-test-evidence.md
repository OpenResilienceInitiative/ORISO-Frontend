# 04 — Test evidence (#1210)

Node 22.12.0, branch `claude/1210/absence-banner-ui`.

- TDD RED: `npx vitest run --project unit src/components/messageSubmitInterface/MessageSubmitInfo.test.tsx` → 3 failures ("Unable to find an accessible element with the role status/alert") — expected
- TDD GREEN: same → pass; `npx vitest run --project unit src/components/messageSubmitInterface` → 28 files / 226 tests pass
- `npx eslint --max-warnings=0` on the touched tsx → pass; `npx stylelint src/components/messageSubmitInterface/messageSubmitInfo.styles.scss` → pass
- `npm run lint:scripts` (eslint + tsc) → pass; `npm run test:unit` → **369/369 files, 4027/4027 tests pass**
- Storybook `Components/Message/MessageSubmitInterface › Asker — counsellor is absent` shot with Playwright (headless Chrome @2x): desktop 1280 → card 895px wide, centred, 8px above the composer; mobile 420 → 54px clearance above the composer navigator (dev baseline: strip partly painted over, see `screenshots/baseline-dev-mobile.png`). Files: `screenshots/after-absence-card-{desktop,mobile}.png`, `screenshots/before-current-dev-banner.png` (shazia-k, dev).
- Live app: NOT yet — needs an advice-seeker login whose counsellor is absent (requested from the account owner); "Willkommen zurück!" dialog (job 2) NOT reproduced (see `01-spike.md`).
