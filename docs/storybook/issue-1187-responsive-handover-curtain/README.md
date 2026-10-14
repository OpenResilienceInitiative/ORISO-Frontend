# #1187 / PR #1721 — persistent wizard, local Storybook proof

All images use fictional data, the real SessionsZone and production shell CSS at DPR1. The two matched before images render immutable d5ea351c52bcaca1e8315791af1d1945e021d8c8 curtain source. The eight after images show the final persistent header/body/footer composition. The image-containing commit identifies their final source.

| File                                    | Surface / viewport / locale | Visible state and proof                                                                                              |
| --------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 10-before-d5-390x420-de-reason.png      | Reason /390×420 /DE         | Matched d5 baseline; body and actions share the scrolling card.                                                      |
| 11-before-d5-390x420-de-description.png | Description /390×420 /DE    | Matched d5 baseline after filling; persistent actions are absent from the panel.                                     |
| 10-after-390x420-de-reason.png          | Reason /390×420 /DE         | Final body at top; native topic and both persistent128×96 actions remain visible.                                    |
| 11-after-390x420-de-description.png     | Description /390×420 /DE    | Final body at top after filling; explanation below body viewport is reached by wheel; header and actions stay fixed. |
| 10-after-1440x900-en-reason.png         | Reason /1440×900 /EN        | Desktop list/detail, native topic strip and reason rows with selected/footer geometry.                               |
| 11-after-390x844-de-description.png     | Description /390×844 /DE    | Phone body at top after filling; fixed header/footer, textarea in normal flow.                                       |
| 11-after-820x1180-de-description.png    | Description /820×1180 /DE   | Tablet body at top after filling; full request controls fit active panel.                                            |
| 10-after-1440x480-de-reason.png         | Reason /1440×480 /DE        | Short desktop body at top; footer stays visible below scrolling content.                                             |
| 11-after-390x420-fr-description.png     | Description /390×420 /FR    | Long French text at body top; explanation below viewport remains wheel reachable.                                    |
| 11-after-320x568-fr-description.png     | Description /320×568 /FR    | Narrow French body at top; header and actions stay inside active panel.                                              |

The shortcut labels deliberately show the bare digits accepted by the existing handler, replacing Figma’s unsupported Cmd/Ctrl+R prefix. Historical9e images/video/receipt are preserved locally under `figma-design-1187/reviewed-9e-curated/`. The screenshots document layout. Public tests prove step transitions, required explanation, body scrolling, keyboard focus and fixed footer bounds. Access/submission logic remains under the existing unit/API tests. The MoreMenu is omitted by explicit user decision. These images do not prove deployed or authenticated acceptance.

The preserved full42-image matrix and five historical overflow-only images live locally at `/Users/frankgerhardt/ORISO/_e2e-artifacts/e2e-20261013-handover-tdd/figma-design-1187/full-matrix/`. The final eight-image measurements are in `docs/agent-tasks/2026-10-14_responsive-handover-curtain/FINAL-FOOTER-GEOMETRY.json`. One fictional Storybook wheel video is `figma-design-1187/13-review-after-short-phone-scroll-de.webm`:390×420, scrollTop0→672→0, footer y232 throughout. Root publishes it with its Storybook-only layer label.

Native component previews returned by local Storybook MCP:

- [Wizard footer](http://localhost:6218/?path=/story/molecules-sidescrollerfooter--wizard), [unchanged profile consumer](http://localhost:6218/?path=/story/registration-askerinfofooter--nothing-pending)
- [Native topic](http://localhost:6218/?path=/story/components-session-sessiontopic--default), [ordinary chat header](http://localhost:6218/?path=/story/components-session-sessionheader--active-conversation)
- [Reason selection](http://localhost:6218/?path=/story/organisms-casehandover-reasonlist--select-with-pointer-and-keyboard), [native textarea](http://localhost:6218/?path=/story/components-form-m3controls--textarea)
- [Short reason](http://localhost:6218/?path=/story/templates-sessions-protectedcaseresponsive--reason-on-short-phone), [short description](http://localhost:6218/?path=/story/templates-sessions-protectedcaseresponsive--description-on-short-phone)
- [Body-only step reset](http://localhost:6218/?path=/story/atoms-scrollablesection--changed-step-resets-only-body)

ScrollableSection's new optional bodyKey is documented in typed source and this tested story. Refreshing its detailed MCP documentation timed out twice; initial native docs and final preview calls succeeded. Raw nonsecret MCP responses are retained under the root artifact's `local-mcp-docs/`; this timeout is reported rather than replaced by guessed props.
