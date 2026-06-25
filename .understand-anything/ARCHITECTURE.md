# Architecture Notes: ORISO-Frontend

## Purpose

ORISO-Frontend is a React and TypeScript application for the Online-Beratung platform. It covers registration, authentication, bookings, profile flows, messaging, Matrix-backed real-time communication, localization, and browser delivery.

## Current Stack

- React 19 with `react-router-dom` v5
- TypeScript with custom webpack scripts
- SCSS, CSS modules, MUI, Emotion, and Compound design assets
- Matrix JS SDK, LiveKit, STOMP, and SockJS for communication features
- Cypress and Storybook for product and component verification
- Docker, Kubernetes YAML, nginx/runtime config, and GitHub Actions for delivery

## Refreshed Graph Shape

- Files analyzed: 1009
- Nodes: 2002
- Edges: 4243
- Layers: 13
- Tour steps: 8

Generated graph outputs and scratch files are excluded from analysis so the graph represents repository code, configuration, docs, tests, and deployment files rather than its own build artifacts.

## Architecture Layers

### Application Shell

Entrypoints, bootstrap code, app composition, and top-level routing.

Representative files:

- `index.ts`
- `src/initApp.tsx`
- `src/App.tsx`
- `src/components/app/AuthenticatedApp.tsx`
- `src/components/app/app.tsx`

### Auth Registration Session

Authentication, registration, invite links, anonymous sessions, access tokens, and access-sensitive guards.

Representative files:

- `src/components/registration/autoLogin.ts`
- `src/components/invite/InviteLink.tsx`
- `src/components/sessionCookie/getKeycloakAccessToken.ts`
- `src/components/sessionCookie/getBudibaseAccessToken.ts`
- `src/utils/anonymousSessionFetchGuard.ts`
- `src/api/apiLogoutKeycloak.ts`
- `src/api/apiTwoFactorAuth.ts`

### API Integrations

Frontend API client modules, generated service typings, fetch helpers, and endpoint constants that connect browser flows to backend Online-Beratung services.

Representative files:

- `src/api/index.ts`
- `src/api/fetchData.ts`
- `src/resources/scripts/endpoints.ts`
- `src/generated/userservice.d.ts`
- `src/generated/messageservice.d.ts`
- `src/generated/videoservice.d.ts`

### Messaging Realtime

Matrix, LiveKit, chat rooms, message submission, uploads, attachments, video calls, and realtime session behavior.

Representative files:

- `src/api/apiGetChatRoomById.ts`
- `src/components/message/MessageAttachment.tsx`
- `src/components/messageSubmitInterface/useDraftMessage.tsx`
- `src/api/videocalls/getJwt.ts`
- `src/generated/liveservice.d.ts`

### Feature Areas

Business feature screens and containers for bookings, profile, appointments, sessions, tools, and product-specific user flows.

Representative files:

- `src/components/profile/profile.routes.ts`
- `src/containers/bookings/booking.routes.ts`
- `src/components/sessionsList/SessionsList.tsx`

### UI Components

Reusable React components, presentation modules, modals, forms, visual primitives, and styles.

Representative directories:

- `src/components/`
- component-local `.styles.scss`
- component-local `.module.scss`

### State Hooks Utilities

Global state, hooks, shared utilities, context helpers, and cross-cutting frontend behavior.

Representative files:

- `src/globalState/index.ts`
- `src/hooks/useAppConfig.tsx`
- `src/components/app/TenantThemingLoader.tsx`
- `src/utils/`

### Localization Styling Resources

Translations, i18n assets, static public assets, styling resources, and theming inputs.

Representative directories:

- `src/resources/`
- `public/`
- `translation-files-current/`

### Tests Stories

Cypress tests, Cypress support commands, fixtures, Storybook configuration, and component stories.

Representative files:

- `cypress.config.js`
- `cypress/e2e/`
- `cypress/support/`
- `.storybook/main.ts`

### Build Tooling Config

Webpack, npm scripts, TypeScript settings, proxy server setup, linting, local tooling, and package manifests.

Representative files:

- `package.json`
- `config/webpack.config.js`
- `scripts/build.js`
- `scripts/start.js`
- `proxy/server.js`
- `tsconfig.json`

### Deployment Infrastructure

Docker, Kubernetes, ingress, runtime config, nginx config, and CI/CD delivery assets.

Representative files:

- `Dockerfile`
- `deployment-v2.yaml`
- `ingress.yaml`
- `ingress-v2.yaml`
- `k8s-temp-frontend.yaml`
- `.github/workflows/frontend-deploy.yml`

### Documentation

Repository docs, architecture notes, planning docs, release notes, and graph documentation.

Representative files:

- `README.md`
- `docs/README.md`
- `docs/architecture/current-architecture.md`
- `.understand-anything/README.md`

### Other Project Files

Remaining tracked files that are part of the repository but do not fit a primary layer.

## Main Relationships

- TypeScript modules are connected primarily by `imports` edges.
- Files contain extracted function and class nodes through `contains` edges.
- Exported functions and classes are represented with `exports` edges.
- Configuration files connect to app entrypoints through `configures` edges.
- Workflow and deployment assets connect to application entrypoints through `triggers` and `deploys` edges.
- Documentation files connect through `related` and `documents` edges.

## API And Service Relationships

The frontend API boundary is local to `src/api/`, `src/generated/`, and `src/resources/scripts/endpoints.ts`. These files describe how browser flows call backend Online-Beratung services, but they are not the authoritative backend implementation. API compatibility changes should be reviewed against the backend service contracts.

## Auth Flow Relationship

Authentication-related graph evidence is concentrated in the Auth Registration Session layer. Key concerns include Keycloak logout, two-factor auth, invite link handling, anonymous sessions, session cookies, join-chat flows, and token handling for video calls.

## Database Relationship

This repository does not contain the authoritative database model or migrations. Database-like evidence is limited to generated service typings, endpoint constants, and Cypress fixtures that model backend payloads.

## Deployment Relationship

Deployment is represented by Docker, nginx/runtime config, Kubernetes YAML, and GitHub Actions workflows. These files show frontend delivery wiring, but environment-specific behavior still needs verification against the target ORISO deployment environment.

## ORISO Ecosystem Fit

This graph is intentionally scoped to ORISO-Frontend. It records local evidence of backend APIs, auth, realtime communication, deployment, and tests, but it does not analyze sibling ORISO services.
