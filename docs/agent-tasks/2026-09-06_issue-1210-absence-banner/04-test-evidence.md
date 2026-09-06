# 04 — Test evidence (#1210)

Node 22.12.0, branch `claude/1210/absence-banner-ui`.

- TDD RED: `npx vitest run --project unit src/components/messageSubmitInterface/MessageSubmitInfo.test.tsx` → 3 failures ("Unable to find an accessible element with the role status/alert") — expected
- TDD GREEN: same → pass; `npx vitest run --project unit src/components/messageSubmitInterface` → 28 files / 226 tests pass
- `npx eslint --max-warnings=0` on the touched tsx → pass; `npx stylelint src/components/messageSubmitInterface/messageSubmitInfo.styles.scss` → pass
- `npm run lint:scripts` (eslint + tsc) → pass; `npm run test:unit` → **369/369 files, 4027/4027 tests pass**
- Storybook `Components/Message/MessageSubmitInterface › Asker — counsellor is absent` shot with Playwright (headless Chrome @2x): desktop 1280 → card 895px wide, centred, 8px above the composer; mobile 420 → 54px clearance above the composer navigator (dev baseline: strip partly painted over, see `screenshots/baseline-dev-mobile.png`). Files: `screenshots/after-absence-card-{desktop,mobile}.png`, `screenshots/before-current-dev-banner.png` (shazia-k, dev).
- Live app: NOT yet — needs an advice-seeker login whose counsellor is absent (requested from the account owner); "Willkommen zurück!" dialog (job 2) NOT reproduced (see `01-spike.md`).
- Job 2 (dialog): TDD RED → 4 of 7 `AbsenceHandler.test.tsx` cases failed on `dev` (non-consultant data with an absence flag opened the dialog; `null` user data crashed; no auth-session check; no re-evaluation on user change) → GREEN after hardening; `npx vitest run --project unit src/components/app` → 5 files / 25 tests; full gate after both changes: `npm run lint:scripts` pass, `npm run test:unit` **370/370 files, 4034/4034 tests**
- Job 2 live, step 1 (own counsellor session, dev.oriso.org): absence set (PUT 200, `/users/data` → `absent: true`), sign out with a page observer → **no dialog** before unload; tab on `/login` without cookie. Step 2 (account owner signed back in as the counsellor): reminder appeared on sign-in (`/profile/einstellungen/sicherheit`), blipped away after 173 ms and re-appeared 2.2 s later (handler remount), closed by the user — i.e. the reminder belongs to the counsellor sign-in, not the sign-out; the remount double-fire is fixed by the sessionStorage memo (9/9 tests).
- Final gate after the sessionStorage memo: `npm run lint:scripts` pass, `npm run test:unit` **370/370 files, 4036/4036 tests**
