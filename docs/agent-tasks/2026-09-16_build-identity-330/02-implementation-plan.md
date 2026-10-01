# Implementation plan

Objective: expose immutable bundle identity in both footer locations.

| Step | Subtask                               | Files                                                                                                                    | Verify with                               | Status  |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------- |
| 1    | Baked identity and shared footer      | node-build/action.yml, config/env.js, runtimeConfig.ts, react-app-env.d.ts, StageLayout, AuthenticatedApp, BuildIdentity | focused Vitest                            | done    |
| 2    | Regressions and two bundle inspection | focused tests and task docs                                                                                              | full unit, script lint, style lint, build | done    |
| 3    | Browser and external delivery         | root-owned evidence                                                                                                      | root review                               | blocked |

Browser checks and publication belong to root. Unknown identity never certifies a deployment.

## F1/F2 follow-up status

| Scope | State | Evidence |
| --- | --- | --- |
| Visible responsive identity and semantic foreground | Source implemented and frozen | StageLayout.tsx and StageLayout.styles.scss |
| Existing legal/navigation and registration bar | Scoped source preservation; rendered check open | 21 focused tests; browser-storybook harness |
| Browser RED/GREEN | Blocked by sandbox before rendering | ART/330-responsive/setup-*-launch-error.log |
| Scoped lint, fixture types, final build | Passed | ART/330-responsive/*.json and *.log |

No other package is reopened. Root owns independent review and rendered acceptance.

### Bounded final follow-up acceptance

| Requirement | Implementation/check | Current gate |
| --- | --- | --- |
| F3 desktop identity cannot collide with visible branding at any content height | Existing right-hand footer surface; actual rendered rectangle assertions for DE/EN/FR | Source corrected; root rendered run OPEN |
| Preserve mobile legal choices and registration clearance | Mobile rules retained; fixed-bar clearance required at every width | Root browser OPEN, FR320 baseline comparison if needed |
| F4 exactly one identity in authenticated waiting route | Typed shell ownership boundary; real entry/waiting components with async states | Local composition GREEN; root actual authenticated route OPEN |
| Public, standalone waiting and ordinary authenticated identity retained | Focused composition regressions | Local GREEN |
| Baked provenance and all prior implementation preserved | Before/after full Frontend manifest and source delta | Final freeze pending |
| Node22 checks, final production build, handoff | ART/330-frontend-final-corrections/ | In progress |

No commits, remotes, deployment, credentials, browser retries, subagents or other
repository edits. Caller owns publication and independent review. Earlier plan
milestones are historical; source readiness is not browser or parent acceptance.

Final local status: all checks above PASS, including 4940 unit tests and final
production build. Source inventory frozen at 23 files. Rendered F3/F4 and separate
independent-review gates remain OPEN; no publication or deployment authorized.
