# Consent and footer evidence — issue 1631

Local Storybook only. No backend, deployment or Dev acceptance is claimed.

- 04/05 pairs: the same accepted-live-chat story at375/1440. Before source dev aa6ab41d; after source accepted integrated local revision0b3119bb. The consent package reproduces those functional files. These are real Chromium captures.
- 06 pair: the user-reported intermediate Back-link footer and the repaired desktop/mobile footer. The after image is captured at57fefbb6;0b3119bb only lowers the account-header avatar12px and leaves this footer unchanged. Agreement was explicitly ticked by the capture play; it is not preselected by the product or by manual stories.
- 07 motion: actual screenshot samples at0/80/160/240/320ms and ready, source57fefbb6. The intrinsic panel grows while content rises from below.375/400/834/1440 action-row bounds were checked; Back and primary-button centres align.
- 08 account avatar: actual375/1440 captures at0b3119bb. Wrapper margins differ by exactly12px from the prior source.
- 09/10/11: historical slide-in demonstrations of invitation, self-help and dialog variants at ef649d03. They document the same shared motion, before the subsequent manual-demo/footer refinement. The final branch's six-family interaction gate verifies current behaviour separately.

13-before-original-registration-mobile.png shows the old existing ReviewSurface account step at dev aa6ab41d. It is contextual evidence, not a pixel-identical counterpart of the newly added final-stage composition. No generated fixture password is published.

The live status remains optional and is shown only after a counsellor accepts. Other flows have a checkbox without that live-only heading. A valid form and usable current legal wording reveal the panel; explicit agreement enables completion. Missing wording fails closed. The callers retain consent/version/locale decisions.

## Reproduce

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
npm run build-storybook
npx vitest run --project storybook src/components/registration/RegistrationFlowSurface.stories.tsx src/components/anonymousChat/liveChatEntryRoom.stories.tsx src/components/registration/entryRoom.stories.tsx src/components/groupChat/selfHelpEntryRoom.stories.tsx src/components/registration/RegistrationRuntime.stories.tsx src/components/registration/registrationTurn8.stories.tsx
```

Use the Storybook Formular-Demo toolbar: manual is the default. Opting into automatic mode fills the demo's answers and shows the panel; agreement remains unchecked. Switching back resets to a healthy manual form. Actual app submit/Back callbacks remain with their original owners.
