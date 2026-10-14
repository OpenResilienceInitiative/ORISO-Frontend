# Frontend #1187 / PR #1721 — persistent protected request wizard

The protected request wizard must keep Back and Next visible while its long body scrolls. The topic belongs in the ordinary chat header strip. This implementation follows the approved desktop/mobile Figma hierarchy through existing Storybook components, while keeping access protection, reason order and mandatory explanation behavior unchanged.

## Current scope and decisions

The user confirmed the public full-app SessionsZone request-form seam and the fixed-footer/native-component scope. The Figma MoreMenu is omitted for now by explicit user decision (“Vorerst weglassen”); no actions are invented. Policy, backend, reason defaults, consent hints, unknown/retired reason handling and explanation validation are preserved. Other phone-menu and general UI defects are outside this package.

| Requirement | Implementation and proof | State |
| --- | --- | --- |
| R1–R4: real active session panel; readable phone/tablet/desktop and DE/EN/FR; protected notice reachable | Production SessionsZone shell, 35 public browser cases, complete title bounds | Passed |
| R5–R8: persistent sibling footer; 128×96 actions; normal body scrolling; actual topic semantics | ScrollableSection + extracted SideScrollerFooter; real wheel movement negative control and fixed geometry; SessionTopic ordinary DOM | Passed |
| R9–R12: existing native form components; exact scoped assets and Figma typography; unchanged profile/header consumers | OrisoTextarea, focused MUI ReasonList, existing shared styles/tokens; 57 Storybook tests including native consumers | Passed |
| R13–R15: preserve access, reasons, keyboard shortcuts and mandatory explanation; no request submission; bounded shared API | Existing curtain/API tests; read-only reason story; wizard-only native-disabled focus fallback; no backend changes | Passed |
| R16: each step opens at the body top without remounting header/footer or losing keyboard focus | Optional ScrollableSection bodyKey; public keyboard Enter/Back test; new native shared story | Passed |

## Composition

ScrollableSection owns fixed header/body/footer slots. Its optional bodyKey remounts only the body at a wizard step transition; its default preserves all other consumers. SideScrollerFooter extracts the existing AskerInfoFooter presentation and keeps that component as the business wrapper. The wizard variant uses the supplied 32px arrow and native disabled controls. Only a clicked, focused wizard action that becomes disabled transfers focus to its enabled sibling; field focus and arbitrary prop changes do not trigger it.

SessionTopic extracts the existing noninteractive chat topic strip with the same DOM and styles. CaseHandoverReasonList composes MUI Radio/ListItemButton primitives for selection and read-only description. The explanation uses the existing OrisoTextarea. The supplied 100px handover asset is scoped to this curtain; global icons are preserved.

## Current RED/GREEN proof

- Persistent footer RED against immutable d5: short phone action bottom646 exceeded pane344. GREEN: sibling footer stays inside the active panel across 21 locale/viewport combinations.
- Actual body-wheel RED: test-only overflow:hidden mutation leaves scrollTop0. GREEN: normal mousewheel moves the short body and returns it to0 while footer y remains fixed.
- Step entry RED: old body retained scrollTop317 after navigation. GREEN: optional bodyKey resets body only; each first heading starts visible.
- Keyboard focus RED: Next became disabled on description entry and lost focus. GREEN: Back remains focused; Back→Reason moves focus to enabled Next, without stealing textbox focus.
- Independent final SPEC and standards follow-up both passed. Final public35 and Storybook57 passed. Full-unit/theme-contract follow-up passed:720 files /12,532 tests; the original profile-only compatibility token is retained unchanged and wizard backgrounds use surface roles.

## Historical proof (superseded implementation)

The d5 overflow-only repair initially passed 12 multilingual browser cases and 720 unit files /12,532 tests. It allowed the whole card to scroll. The user corrected that presentation: actions belong outside the body, the topic belongs in the native strip, and existing components must be reused. Those initial logs and images remain historical evidence; they do not describe the final production structure.

## Evidence boundary

Settled actual Dev widths matched the public fixture: phone detail 390px/card 374px; tablet detail 820px/card 788px. The originally reported narrow strip and tablet overflow were captures during the existing CSS transition. They do not justify a width repair. The root agent confirmed the actual Dev protection notice disappeared after focusing the description field; do not describe the width hypothesis as a confirmed defect.

**For developers — graph and source context:**

```text
Base/candidate source: origin/dev 26e1b7ea7d7d94f1fb6516dd235077e3b0ad139b
Online graph URLs:
https://understand.oriso.org/ua/current/ORISO-Frontend/.understand-anything/knowledge-graph.json
https://understand.oriso.org/ua/current/ORISO-Platform/.understand-anything/knowledge-graph.json
Graph generation: 747d86fc-7221-43a7-a8b9-6081be8d394c
Graph source main: b3487d6a33e5174cef30f578e9f46b8f120c0da9 (dated orientation versus dev)
Relevant nodes: file:src/components/app/SessionsZone.tsx; function:src/components/app/SessionsZone.tsx:SessionsZone;
file:src/components/session/CaseHandoverCurtain.tsx
No platform responsive layout policy edge was found. CONTEXT.md handover vocabulary and
repository engineering/component rules were read. This repair changes no domain contract.
```

## Resume here

All final source gates passed: public35, native Storybook57, full unit720 files /12,532 tests, script/style lint, Storybook typecheck and production build/postbuild. Both independent final reviews passed. Eight final after screenshots and two matched d5 baselines are curated; the synthetic short-wheel video measures body0→672→0 and fixed footer y232. Create the normal local commit, then build with REACT_APP_BUILD_COMMIT set to that exact HEAD for root Docker provenance. No further source change is needed.

Root owns push, current PR description/review/CI readback, evidence publication, actual Docker/Dev acceptance and deployment decisions. Old d5 remote CI/CodeRabbit approval does not cover the unpublished final source. This worker has not submitted a live request or changed accounts/data.
