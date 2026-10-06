# Local evidence

Environment: Node 22.12.0, isolated worktree, base `4e9f0b00dec34f64b0a1ce49f187054f6b7d51dd`. No browser or deployment performed by this implementation agent.

- Focused unit command (StageLayout, BuildIdentity, runtimeConfig.buildIdentity, runtimeConfig.observability) → pass, 18 tests.
- `npm run lint:scripts` → pass, includes production TypeScript.
- `npm run lint:style` → pass.
- `npm run test:unit` → pass, 4932 tests.
- `REACT_APP_PLATFORM_VERSION=v2.0.6 REACT_APP_BUILD_COMMIT=<fixture> npm run build` → both builds pass, including postbuild host guard. Each JavaScript artifact contains only its own full commit fixture; checksums differ.
- Scoped Prettier and `git diff --check` → pass.
- Extracted CI build step with conflicting GITHUB_SHA fixture → injected actual checkout HEAD.
- `config/env.js` with absent build commit → explicit empty DefinePlugin constant.

The release/commit values used for two-build inspection are test inputs against uncommitted source, not claims of deployed or committed builds. Bundle hashes and retained RED/GREEN command/source manifests are in the shared artifact's `330-implementation-logs/` directory.

Behavioral RED is `frontend-footer-behavioral-red.log` (missing short commit in rendered StageLayout). The earlier `frontend-footer-red.log` is only a dependency setup failure. No a11y, CI, or test errors were suppressed. Browser fixture/readback, Storybook/axe and deployment acceptance remain root/operator gates.

## F1/F2 follow-up

- Focused StageLayout, BuildIdentity, runtimeConfig build identity and registration-footer contract tests: 21 passed.
- Scoped ESLint and stylelint: passed.
- Storybook fixture typecheck, ESLint and Prettier: passed after correcting the fixture runtime-window type. Initial failure retained.
- Production build with explicit release/commit fixture: passed, including postbuild host validation; existing warnings retained.
- Full 4932-test historical run was not repeated for this scoped rendering/style change.
- Browser: blocked before rendering in both Chrome and Chromium. These are setup errors; no new RED/GREEN or contrast acceptance claimed. Root's existing baseline is preserved.
- Reproduction: [browser runner](browser-storybook/README.md). Logs and exact source hashes: ART/330-responsive.

## Final F3/F4 corrections (2026-09-16)

- Independent original composition probe, byte-identical local copy → behavioral
  RED (public passes; authenticated waiting room has 2 identities, expected 1).
- Final actual waiting/entry route composition → 8/8 pass; controlled API responses
  exercise loading/ready/missing/failure, ordinary shell and standalone ownership.
- Focused unit regressions → 50/50 pass in 9 files.
- `npm run test:unit` → 4940/4940 pass in 468 files, one full run.
- `tsc --noEmit`, Storybook types, touched production/test ESLint and StageLayout
  stylelint, format and diff checks → pass under Node22.12.0.
- `npm run build` with release v2.0.6 and base-SHA fixture → pass, including postbuild.
  This uncommitted tree is not attested by the synthetic build input.
- Final DE/EN/FR 108-case probe syntax/format → pass; rendered assertions NOT EXECUTED.
- F3 behavioral RED remains root's EN1440 measurement; no worker browser launch.
- Logs/command metadata: ART/330-frontend-final-corrections/. Root owns rendered,
  actual authenticated-route and independent-review acceptance.
