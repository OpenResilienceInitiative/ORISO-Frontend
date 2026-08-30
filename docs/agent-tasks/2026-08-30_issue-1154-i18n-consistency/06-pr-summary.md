# PR summary — #1154 stacked slices

Parent: [ORISO-Frontend#1154](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154). Scan comment: [5468992934](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154#issuecomment-5468992934).

GitHub cannot nest PRs. This issue is the parent. Three stacked PRs, each reviewable alone:

1. **Weblate overlay** (`cursor/1154/weblate-bundle-wins` → `pre-dev`) — bundle wins on key conflict so a stale Weblate file cannot undo #1170/#1227 catalogues.
2. **Preselected topic** (`cursor/1154/preselected-topic-locale` → PR1 branch) — `PreselectedTopic` uses `getRegistrationTopicDisplay`.
3. **German defaultValues** (`cursor/1154/registration-german-fallbacks` → PR2 branch) — signup chrome calls `t(key)` without hardcoded German fallbacks.

## Files changed

See `git diff --stat` per slice in the progress session. Combined vs `origin/pre-dev` is the three slices stacked.

## Test evidence

See `04-test-evidence.md`. Headline: targeted vitest green; `lint:scripts` pass. Verified **local only**.

## Screenshots

None — no running frontend this turn. Reviewer should switch registration to `fr` and `ru` on Pre-Dev after merge.

## Risks / follow-ups

- Weblate-only locales still load when the bundle is empty.
- Age/state option labels stay German (ConsultingTypeService).
- Ukrainian is not a UI locale (`supportedLngs` has no `uk`).
- Agency names and Träger consent body are API/CMS owned.
- If translation cache is enabled in an environment, old Weblate merges linger until TTL.

## Security

No auth, storage, or Matrix plaintext changes. Weblate fetch already existed; only merge order changed.
