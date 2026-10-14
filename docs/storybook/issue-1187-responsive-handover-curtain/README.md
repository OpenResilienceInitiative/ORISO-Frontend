# #1187 — protected request form, local Storybook proof

All images use fictional data, German, the real SessionsZone and production shell CSS, on the local Storybook dev server. The baseline is dev commit `26e1b7ea7d7d94f1fb6516dd235077e3b0ad139b`; after images show the corresponding candidate working tree with the one card overflow repair. The image-containing commit identifies the final source revision.

| File                            | Surface and viewport                       | What it proves                                                                                                               |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 01-before-phone-description.png | Protected description, 390×844, baseline   | After normal wheel scrolling, the request controls are still clipped beneath the card.                                       |
| 02-after-description-390.png    | Protected description, 390×844, candidate  | Normal wheel scrolling reaches both navigation controls. The notice is above the scrolled viewport and can be reached again. |
| 03-after-description-820.png    | Protected description, 820×1180, candidate | The description and controls fit the tablet pane.                                                                            |
| 04-after-description-1440.png   | Protected description, 1440×900, candidate | The desktop list and form remain side by side and usable.                                                                    |
| 05-after-description-320.png    | Protected description, 320×568, candidate  | Normal scrolling reaches the controls on a short phone screen.                                                               |

Screenshots show layout only. The Playwright regression proves normal step transitions, selected reason, textbox entry, control reachability and scrolling back to the notice. Existing unit/API integration tests cover access protection and submission behavior. These artifacts do not establish a deployed fix or a successful backend request.

Local previews returned by the Storybook MCP:

- [Phone](http://localhost:6218/?path=/story/templates-sessions-protectedcaseresponsive--phone)
- [Tablet](http://localhost:6218/?path=/story/templates-sessions-protectedcaseresponsive--tablet)
- [Desktop](http://localhost:6218/?path=/story/templates-sessions-protectedcaseresponsive--desktop)
- [Existing wizard walkthrough](http://localhost:6218/?path=/story/organisms-casehandover-casehandovercurtain--wizard-walkthrough)
