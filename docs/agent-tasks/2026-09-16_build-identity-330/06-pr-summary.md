# Frontend 1420 source handoff

The footer now shows the bundle's short source commit beside the existing release. The full commit is machine-readable. CI takes the actual checkout commit; runtime configuration cannot override it. Public and authenticated footers share one component and retain their existing Text/div renderers and classes.

Verification is local only; see [test evidence](04-test-evidence.md). Root supplies browser screenshots, independent review and PR publication. Base: dev. No deployment or operator release choice has occurred; parent planned v2.0.6 is not an installed-target assertion.

Reviewer checks:

- [ ] Open the public footer and an authenticated page; the same short commit appears beside the release.
- [ ] Inspect `data-build-commit`; it contains the full expected checkout commit.
- [ ] Change runtime release/configuration; commit stays baked.
- [ ] Run G121 with independently recorded release and both image source commits; wrong or missing values fail.

Task docs are intentionally present beneath the repository's ignored task-doc directory; root must explicitly include them when committing.

## F1/F2 scoped follow-up (not browser accepted)

The public build identity now has a footer visibility exception for small layouts and desktop login, while legal-link choices remain unchanged. Its text uses existing on-primary over the desktop stage and on-surface-variant on the mobile sheet. The registration footer keeps clearance up to the existing stage breakpoint. Authenticated identity rendering/styles remain unchanged.

Local verification: 21 focused tests, scoped lint, fixture types/format, production build. Browser acceptance is BLOCKED by sandbox launch restrictions; root must run the retained real-component browser harness and publish before/after evidence. No screenshots, contrast pass, deployment or full-ticket completion is inferred from these checks.

## Final correction handoff (source only; publication owner is root)

F3 moves the desktop identity into the existing content-side footer surface,
independent of the fixed left stage heading. F4 gives the ready authenticated
shell exclusive identity ownership, preserving public/standalone stage labels
and the shell label across entry-room loading/missing/failure states.

4940 unit tests pass; app/Storybook types, scoped lint/format and final production
build pass. New rendered branding/locale checks are NOT EXECUTED in the worker.
Root must attach its matched before/after evidence and actual authenticated-route
verification, and obtain separate independent review before publication. Do not
use the isolated authenticated Storybook identity as full app-composition proof.
