# PR summary

## What changed

- Removes the last Rocket.Chat/DDP endpoint and protocol responses from the
  active Storybook preview.
- Deletes the obsolete Storybook 7 backup that still installed Rocket.Chat
  providers.
- Updates Storybook documentation to the Matrix/LiveService/LiveKit
  architecture.
- Extends the Matrix-only regression contract to scan Storybook and tracked
  backup files.

## Why

The target architecture is exclusively the ORISO frontend with Matrix,
ORISO-controlled MatrixRTC / Element Call, and LiveKit. Rocket.Chat and Jitsi
must not remain as providers, fallbacks, or dormant repository contracts.

## Verification

- 215 unit-test files / 1,398 tests passed.
- Script lint, TypeScript, style lint, production build, and Storybook build
  passed.
- The regression test was observed failing before the cleanup and passing
  afterward.

## Scope

- Follow-up for #789 and the Matrix-only cutover epic #302.
- No merge, deployment, or deployed-runtime claim is part of this change.
