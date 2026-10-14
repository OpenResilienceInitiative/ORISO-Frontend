# Frontend #1187 — responsive protected request form

A counsellor needs to reach every request control without losing the ability to scroll back to the protection notice. On short phone screens, the description step exceeds the rounded card. The card hid the overflow and could only be scrolled indirectly by focusing a field; wheel and touch scrolling could not reach the request button.

The user confirmed the public responsive request-form seam. The regression runs the real SessionsZone routes and production authenticated/session/list CSS, with fictional case data and the existing curtain wizard. It does not submit requests or grant access. The root agent separately owns actual Dev and candidate app verification.

## Current state

1. RED: normal pointer scrolling failed to reveal the request button at 390×844 and 320×568; 820×1180 and 1440×900 passed. Phone card height 752px, content height 845px; request controls started at y769 outside the pane.
2. Minimal production repair: the existing card keeps horizontal clipping and allows vertical scrolling. Widths, responsive breakpoints, routing and access behavior are unchanged.
3. GREEN: all four viewports passed, including scrolling back to the protection heading. German, English and French all pass (12 browser cases); the entire protection heading must fit inside the pane after scrolling back.
4. Required gates: script lint/typecheck, style lint, production build/postbuild, Storybook typecheck and focused Storybook (2 files, 13 tests plus axe) passed. The full unit suite passed 720 files / 12,532 tests. Independent review found no production finding; its requested full-heading bounds assertion is now implemented and passes.

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

The source repair and public regression are GREEN. Final unit and trilingual responsive checks passed; create the local commit after the final focused Storybook readback. The root agent owns push, PR, reviewer requests, issue evidence and actual candidate verification. No deployment or live request submission has been performed by this worker.
