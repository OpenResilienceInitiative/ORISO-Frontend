# Final local verification — persistent protected wizard

The wizard now keeps its existing protection header/topic and native footer in fixed sibling slots, while the body scrolls. The request state machine, access predicate, reason policy, mandatory trimmed explanation, API payload and normal chat layout are unchanged. The MoreMenu omission is explicitly user approved.

**For developers — final source gates and TDD:**

```text
Node 22.12.0; dependencies from locked npm ci --legacy-peer-deps.
Public geometry/interactions: 35 passed, 1.0m; DPR1; DE/EN/FR.
Focused Storybook/native consumers: 9 files /57 tests including axe passed,14.55s.
Repeated after final compatibility Sass correction: 9 files /57 tests passed,12.44s.
lint:scripts (ESLint + TypeScript): passed.
lint:style: passed after final compatibility correction.
typecheck:storybook: passed.
Production build + forbidden-host postbuild: passed after final Sass correction;
exact commit-metadata build follows the local commit.
Full unit first run: 719 files passed /1 failed;12531 passed /1 failed.
Failure: m3Sweep detected the original profile idle token after it was inlined.
Targeted theme-contract correction: m3Sweep 9 tests passed (629ms).
Final full unit rerun: 720 files /12532 tests passed,288.80s.
Independent SPEC + standards: final follow-ups PASS, including profile compatibility.
```

The theme failure was fixed by retaining the original `$footerButtonNextIdleColor` unchanged from the old AskerInfoFooter Sass, scoped only to the profile variant. Its active primary override remains. Wizard disabled backgrounds use the M3 surface-variant role. The sweep and its allowlist were not changed; this preserves the existing profile appearance during extraction.

**For developers — public RED/GREEN evidence:**

```text
FOOTER-RED: immutable d5 short390×420 action bottom646 > active pane344.
BODY-SCROLL-RED: explicit test-only overflow:hidden mutation; scrollTop remained0.
BODY-SCROLL-GREEN: normal wheel moves the body down and back while footer stays fixed.
STEP-ENTRY-RED: previous body retained scrollTop317 after Next.
FOCUS-RED: Next became disabled on description entry and lost focus.
STEP-FOCUS-GREEN: body starts0; Next→Description focuses enabled Back;
Back→Reason focuses enabled Next; arbitrary prop changes/field focus untouched.
Final video: fictional Storybook390×420; scrollTop0→672→0; footer y232→232→232.
```

The 35 browser cases cover protection-title bounds, panel/viewport fit, native topic semantics, reason selection, keyboard shortcuts/steps, required explanation enablement, persistent actions and real mousewheel scrolling. Requests are never submitted. Existing curtain/API tests cover request behavior; these local UI artifacts do not establish real authentication, backend acceptance or deployment.

Ten selected screenshots and captions live in `docs/storybook/issue-1187-responsive-handover-curtain/`. `FINAL-FOOTER-GEOMETRY.json` records the final eight after images. The two matched before images render immutable d5 curtain source inside the same production SessionsZone shell through a temporary isolated Vite loader; that harness is stopped and excluded from Git. Original five overflow-repair images and the 42-image matrix are preserved in the root-owned local artifact directory `figma-design-1187/full-matrix/`. The short wheel video is `figma-design-1187/12-after-short-phone-scroll-de.webm`.

The image-containing commit pins the final source; the subsequent build uses that exact value as REACT_APP_BUILD_COMMIT. Runtime origins still use existing runtimeConfig/config.js injection, and build identity intentionally bypasses runtime override. The build is the worktree's ignored `build/` directory, with `beratung-hilfe.html` as app HTML. Root owns immutable Docker packaging and normal protected-app verification against separately measured Dev services.

Historical d5 proof: `RED.txt`, `GREEN.txt` and `FOOTER-GEOMETRY.json` describe earlier source. Full final gate logs remain outside Git under `/tmp/1187-final-*`. This worker performed no push, PR mutation, account/data change, live request or deployment.

Existing PR1721 was read back before the local commit: base dev, remote head d5ea351, three requested human reviewers (shazia-k, Shirloin, hasanbarisgok), CodeRabbit approved that earlier head with no actionable recent comments. Its old CI/review does not cover this unpublished final commit; root must read new review/CI after push.
