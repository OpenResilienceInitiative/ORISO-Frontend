# Spike

## Current behavior

- `.storybook/preview.tsx:432` still mocks the retired
  `/api/v1/settings.public` endpoint.
- `.storybook/preview.tsx:516` keeps a generic WebSocket shell, but
  `.storybook/preview.tsx:558-625` responds with Rocket.Chat/DDP login, room,
  subscription, and public-settings payloads.
- `.storybook/preview.tsx.sb7.bak` is a tracked obsolete configuration with
  Rocket.Chat providers.
- `.storybook/README.md:47` still describes Rocket.Chat context providers.
- `src/matrixOnlyLegacyArtifacts.test.ts` protects Cypress and production
  artifacts but does not scan `.storybook`.

## Root cause / gap

The Matrix-only cutover removed product runtime imports but its repository
guard did not include Storybook text artifacts. The generic Storybook
WebSocket mock was retained together with an obsolete DDP response layer and
backup file.

## Approach

Keep the protocol-neutral open/close WebSocket and EventSource shell needed by
the LiveService Storybook environment, but make WebSocket `send` a no-op and
delete all DDP-specific responses. Remove the backup and legacy fetch endpoint,
update the README, and extend the existing Matrix-only contract over
`.storybook`.

## Files likely to change

- `.storybook/preview.tsx` — remove legacy endpoint and DDP behavior.
- `.storybook/preview.tsx.sb7.bak` — delete obsolete provider backup.
- `.storybook/README.md` — describe current Matrix/LiveService contexts.
- `src/matrixOnlyLegacyArtifacts.test.ts` — scan Storybook and ratchet retained
  generic realtime behavior.

## Risks and edge cases

- LiveService uses SockJS/STOMP, not DDP; preserve the generic local WebSocket
  constructor, ready-state transitions, and EventSource mock.
- Storybook may expose a compile-time dependency missed by unit tests; run its
  production build in addition to the repository hard gate.

## Test strategy

- Red/green `src/matrixOnlyLegacyArtifacts.test.ts`.
- `npm run build-storybook`.
- Required full unit, script lint, style lint, and production build gates.
