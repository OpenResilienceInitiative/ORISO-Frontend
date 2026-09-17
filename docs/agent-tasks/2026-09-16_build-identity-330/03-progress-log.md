# Iterations

1. Setup failure: missing `@storybook/addon-vitest` in the owned dependency copy. `npm ci` first rejected Node 24; retry with installed Node 22.12.0 restored the exact lockfile dependencies. No package/lockfile changes.
2. Behavioral RED: the existing StageLayout rendered `v2.0.6`, so the assertion for `v2.0.6 - 4e9f0b0` failed. GREEN: shared BuildIdentity plus baked accessor and CI injection made it pass; registration link assertion remained green.
3. Boundary regression: 18 focused tests pass, including both renderer variants, full/short commit, fixed release with different commits, runtime/Cypress spoofing, malformed/missing commit, and missing release. Full script lint/typecheck and style lint pass. Full unit passes (4932 tests). Both production builds pass and contain their different full commit fixtures at the same release.

Exact commands, source hashes, RED/GREEN logs and bundle checksums live in the shared implementation artifact directory linked by the brief. Root owns browser evidence, separate review and publication.

### F1/F2 follow-up — source frozen, browser gate blocked

- Verified all 16 original Frontend manifest hashes before touching source.
- Added a real-component Storybook regression fixture and Playwright runner before production changes. Chrome and Chromium both aborted before rendering; raw errors retained separately from root's existing RED evidence.
- Kept the footer visible only when an identity exists; preserved small-screen legal choices, login choices and registration clearance. Identity uses on-primary over the desktop stage and on-surface-variant on the mobile sheet. Authenticated styling unchanged.
- 21 focused tests, scoped lint, final fixture typecheck/format and production build passed. Initial fixture typing errors were fixed and retained in storybook-types.log.
- No worker browser RED/GREEN exists. Root must run the retained harness outside the sandbox and independently review before acceptance.

### Final corrections iteration — F3/F4, local checks in progress

- Intake: bounded caller request; preserve the frozen 22-file implementation.
- Before: all 22 hashes match; original independent composition probe reproduced
  one passing public case and one failing waiting-room case (2 identities, expected 1).
- F3: move only desktop identity footer into the existing 60vw content surface;
  retain mobile layout/legal choices and reserve registration-bar space on desktop too.
- F4: typed authenticated ownership boundary around the existing ready-route content;
  StageLayout renders its identity only outside that owner. No auth gate/navigation edit.
- Tests: real GroupWaitingRoom and GroupEntryRoom loading/ready/missing/error composition,
  public build-only, ordinary authenticated and standalone waiting-room cases.
- Focused verification: 50 pass; app/Storybook types, scoped ESLint/stylelint/format pass.
- Browser: no launches. New 108-case DE/EN/FR branding rectangle probe is unexecuted;
  root's existing F3 behavioral RED is retained. Full unit and final build in progress.

### Final corrections freeze — local PASS, root acceptance OPEN

- Full unit: 4940 tests / 468 files passed; one run, Node22.12.0.
- Final production build and postbuild host validation passed; no repeated build.
- Production source is settled. Full manifest retains the original 22 paths plus
  the one new composition regression (23 files). Provenance inputs unchanged.
- Root must run the new 108-case rendered probe and actual authenticated routes;
  no new worker browser evidence or independent approval is claimed.
- Detailed report and separate handoff are in ART/implementation-330-frontend-final-corrections.md
  and ART/330-frontend-final-corrections-handoff.md.
