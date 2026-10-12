# F1/F2 rendered regression

This harness imports the repository's actual Storybook Vite config, preview,
semantic theme, Stage/StageLayout/Text/BuildIdentity styles and real
RegistrationFooter. The authenticated fixture is the real BuildIdentity with
its authenticated stylesheet; it does not establish an authenticated session.
The fixture supplies release v2.0.6 and bakes the supplied base commit in its
Vite config. These are test inputs, not provenance of a deployed artifact.

From this worktree, under Node 22:

```sh
node_modules/.bin/storybook dev \
  --config-dir docs/agent-tasks/2026-09-16_build-identity-330/browser-storybook \
  --port 6033 --ci --no-open
```

In a second terminal, set EVIDENCE_DIR to a new output folder, then run:

```sh
node docs/agent-tasks/2026-09-16_build-identity-330/browser-storybook/check-responsive.mjs
```

The runner owns and closes its isolated Playwright Chromium. Stop only this
Storybook server with Ctrl-C afterwards. Ports 6022/6023/6024 and root's browser
are not part of this harness.

It checks public, login, registration and the authenticated identity at
390/820/1440/320/412 and 899/900/1199/1200 pixels. Assertions cover visible and
unique full identity, viewport bounds, horizontal overflow, existing legal-link
visibility, registration-bar and content clearance, semantic foreground and
four screenshot background samples with contrast >= 4.5. This is a targeted
contrast probe, not a whole-page axe pass or a deployed application test.

## RED replay

Root's original rendered baseline and contrast evidence remain in ART/330-browser.
For a fresh RED run, use a disposable copy of the final source with the exact
`330-responsive/pre-fix-StageLayout.tsx` and
`330-responsive/pre-fix-StageLayout.styles.scss` copied back to their corresponding
source paths. Keep the final fixture and runner identical in both runs. Restore
the final two source files in that disposable copy for GREEN. Record hashes of
all inputs. Do not replace files in the frozen implementation worktree.

## Execution status

This session could not launch a browser: Chrome aborted and bundled Chromium
reported MachPortRendezvous bootstrap_check_in Permission denied (1100). Both
logs are retained as setup errors, not RED. The runner has passed syntax checking
and its fixture has passed Storybook typechecking; its assertions have NOT been
executed. Root must execute and review it outside that restriction before any
browser-acceptance claim. No assertion has been weakened to manufacture GREEN.

## Final F3/F4 follow-up (2026-09-16)

The current runner adds **108 cases**: the same four surfaces and nine widths,
for each of DE, EN and FR. `STORYBOOK_ORIGIN` optionally selects root's own server
(default remains localhost:6033). It sets the Storybook locale global and checks
the actual title/legal translations against the corresponding source JSON; merely
setting the browser locale does not count as locale proof. The isolated authenticated
label has no translated copy and is explicitly exempt from that locale oracle.

New checks record every visible desktop title/claim/carrier-logo and mobile
brand/headline/claim rectangle and require no intersection with the identity.
The desktop identity must stay in the right-hand content surface, using its
on-surface foreground. Fixed registration-bar clearance now applies on desktop
as well, because the identity occupies that column. Existing mobile column,
legal visibility, full commit, uniqueness and contrast assertions remain.
Short fixture content is unchanged.

**New rendered assertions have not executed in the restricted worker.** Root's
prior EN public/login 1440 failure is the existing behavioral F3 RED. For a matched
new replay, retain this final runner and the corrected Storybook fixture in both
copies; use `ART/330-frontend-final-corrections/before/` for the 22 source files
immediately before F3/F4, then the final manifest for the after run. The older
F1/F2 replay instructions above address the earlier visibility/color baseline,
not this F3 correction. Root owns its port6034 copy; this worker did not control it.

The independent original F4 test remains in
`ART/330-independent-frontend/review330-independent.test.tsx`. A byte-identical
local copy reproduced its 2-versus-1 assertion before the fix. The repository
`BuildIdentity.composition.test.tsx` keeps the one-identity assertion and adopts
the actual authenticated ownership boundary. It also dispatches a real entry
route through loading, ready, missing and failure states. Authentication bootstrap,
CSS geometry and the live app remain separate root browser gates.

The reported FR320 legal clipping is not asserted to be a new regression.
This follow-up does not change mobile legal layout; compare the exact pre-follow-up
copy before drawing a legal-geometry conclusion.

## F5 actual nested waiting follow-up

`AuthenticatedWaiting` renders the actual AuthenticatedBuildIdentityBoundary and
GroupWaitingRoom, including its real StageLayout and disabled Join bar, matching
the root F5 RED inputs. `AuthenticatedWaitingCalendar` adds a planned start,
calendar action and enabled Join. Neither story authenticates or fetches live data.
No fixture padding or production control mocks are added.

The current probe has **162 cases**: all prior 108 plus both nested waiting
surfaces at every locale/width. It requires the actual fixed bar and expected
Join/calendar controls, measures their nonintersection with the identity, and
performs 9-point hit tests on text and controls. It temporarily restores pointer
hit testing on each inspected element (including disabled buttons), then restores
the exact prior property/priority before screenshots. Button sample points stay
inside rounded corners; identity samples extend to 5%/95% of the text bounds.
All earlier geometry, locale, legal-choice, uniqueness, SHA and contrast checks
remain. Hit tests plus contrast complement rectangle visibility.

As before, the probe scrolls to the footer. This proves neither first-fold
visibility nor scroll behavior by itself; root must inspect the initial view and
reachability as well. The stage footer is in document flow, using the existing
registration clearance; the shell label remains fixed on routes without a stage.

**F5 browser execution is OPEN and root-owned.** This worker ran syntax checking,
component regressions and type/lint checks only for the harness. Do not overwrite
root's port6034 story or probe. Root may copy the new frozen candidate to a separate
owned surface and set `STORYBOOK_ORIGIN` and a fresh `EVIDENCE_DIR`. For a matched
F5 replay, keep these stories/probe identical and compare production source in
`ART/330-frontend-f5/before/` with the F5 frozen source. Preserve the earlier
`ART/330-responsive/root-waiting/` RED and all prior manifests.
