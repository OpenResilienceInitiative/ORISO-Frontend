# ORISO Ecosystem Notes: ORISO-Frontend

This graph represents only the ORISO frontend repository. It does not analyze parent directories, sibling repositories, backend services, or infrastructure repositories outside this checkout.

## Local Role

ORISO-Frontend is the browser application for the Online-Beratung platform. It owns user-facing flows for registration, authentication, bookings, profile management, messaging, real-time communication, theming, localization, and frontend delivery.

## Local Integration Evidence

- Backend service access is represented by `src/api/`, generated service typings under `src/generated/`, and endpoint constants under `src/resources/scripts/endpoints.ts`.
- Authentication and session behavior is represented by Keycloak logout, two-factor auth, invite links, anonymous session guards, auto-login, and session cookie utilities.
- Real-time communication is represented by Matrix, message, attachment, chat-room, LiveKit, and video-call modules.
- Deployment evidence is local to Docker, Kubernetes YAML, GitHub Actions, nginx/runtime config, and Storybook delivery files.
- Test and fixture evidence lives in Cypress support commands, e2e tests, and service fixture JSON files.

## Boundaries

- Database relationships are inferred only from local frontend schema, fixture, and generated service files. This repository does not contain the authoritative backend database model.
- API compatibility must be verified against backend contracts outside this graph when changing generated service typings or endpoint usage.
- Deployment behavior must be reviewed with the target ORISO environment because this graph only sees local YAML, Docker, and workflow files.
