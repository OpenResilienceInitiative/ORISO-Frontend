# ORISO Ecosystem Notes: ORISO-Frontend

This graph represents only the ORISO frontend repository. It does not analyze parent directories, sibling repositories, backend services, or infrastructure repositories outside this checkout.

## Local Role

ORISO-Frontend is the browser application for the Online-Beratung platform. It owns user-facing flows for registration, authentication, bookings, profile management, Matrix-backed messaging with end-to-end encryption, embedded Element Call video calls, theming, localization, transactional e-mail templates, and frontend delivery.

## Local Integration Evidence

- Backend service access is represented by `src/api/` modules, generated typings for `userservice` and `agencyservice` under `src/generated/`, and endpoint constants under `src/resources/scripts/endpoints.ts`.
- Authentication and session behavior is represented by Keycloak logout, two-factor auth, invite links, anonymous session guards, auto-login, session cookie utilities, and Matrix credential handover after login.
- Real-time communication runs on Matrix: `src/services/` holds the client, crypto/key-backup, device, transport, and call modules (matrix-js-sdk plus the Rust crypto WASM), with `matrix-widget-api` embedding Element Call and LiveKit as the media layer.
- The `src/emails/` kit builds the committed e-mail templates, the Keycloak e-mail theme, and the MailService template set consumed by sibling services.
- Deployment evidence is local to Docker, Kubernetes YAML, GitHub Actions, nginx/runtime config, and Storybook delivery files.
- Test evidence lives in Vitest unit and Storybook-project tests, Playwright smoke/cross-browser specs, and Cypress e2e/component tests with service fixture JSON files.

## Boundaries

- Database relationships are inferred only from local frontend typings, fixtures, and generated service files. This repository does not contain the authoritative backend database model.
- API compatibility must be verified against backend contracts outside this graph when changing generated service typings or endpoint usage; the Matrix homeserver and Element Call/LiveKit infrastructure are likewise external to this repository.
- Deployment behavior must be reviewed with the target ORISO environment because this graph only sees local YAML, Docker, and workflow files.
