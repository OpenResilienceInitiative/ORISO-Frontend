# Architecture Notes: ORISO-Frontend

## Purpose

ORISO-Frontend is a React and TypeScript application for the Online-Beratung platform. It covers registration, authentication, bookings, profile flows, Matrix-backed messaging and end-to-end encryption, embedded video calls, transactional e-mail templates, localization, and browser delivery.

## Current Stack

- React 19 with `react-router-dom` v7
- TypeScript with a custom webpack build pipeline (`scripts/build.js`, `config/webpack.config.js`); Vite powers Storybook, Vitest, `vite-node` scripts, and the Matrix crypto smoke harness
- SCSS, CSS modules, MUI 5, Emotion, styled-components, and Compound design tokens/components (`@vector-im/compound-*`)
- Matrix JS SDK v38 with the Rust crypto WASM stack (`@matrix-org/matrix-sdk-crypto-wasm`), `matrix-widget-api` for embedded Element Call, and LiveKit client/components
- TipTap v3 message composer (Draft.js remains in a handful of legacy modules)
- Jotai atoms (`src/store/`) alongside the long-standing `src/globalState/` context
- Vitest, Storybook 10 (react-vite) with a story test runner, Playwright smoke/cross-browser specs, and Cypress e2e/component tests
- Docker, Kubernetes YAML, nginx/runtime config, and GitHub Actions for delivery
- OpenTelemetry metrics packages for browser-side observability

## Refreshed Graph Shape

- Files analyzed: 1673
- Nodes: 4299
- Edges: 4010
- Layers: 8
- Tour steps: 8

Generated graph outputs and scratch files are excluded from analysis so the graph represents repository code, configuration, docs, tests, and deployment files rather than its own build artifacts. The current graph groups files into eight coarse layers (Core, Configuration, API, Utility, UI, Service, Test, and a Domain Concepts enrichment layer); the functional areas below describe the codebase itself.

## Architecture Areas

### Application Shell

Entrypoints, bootstrap code, app composition, and top-level routing. Routing uses React Router v7 (`BrowserRouter`/`Routes` in `app.tsx`, route tables in `RouterConfig.tsx`).

Representative files:

- `index.ts`
- `src/initApp.tsx`
- `src/components/app/app.tsx`
- `src/components/app/AuthenticatedApp.tsx`
- `src/components/app/RouterConfig.tsx`
- `src/components/app/SessionsZone.tsx`

### Auth Registration Session

Authentication, registration, invite links, anonymous sessions, access tokens, and access-sensitive guards.

Representative files:

- `src/components/registration/autoLogin.ts`
- `src/components/invite/InviteLink.tsx`
- `src/components/sessionCookie/getKeycloakAccessToken.ts`
- `src/utils/anonymousSessionFetchGuard.ts`
- `src/api/apiLogoutKeycloak.ts`
- `src/api/apiTwoFactorAuth.ts`
- `src/components/app/authenticatedMatrixLoginData.ts`

### API Integrations

Frontend API client modules, generated service typings, fetch helpers, and endpoint constants that connect browser flows to backend Online-Beratung services. Generated typings are now limited to `userservice` and `agencyservice`; the former messageservice/videoservice/liveservice typings were removed with the Matrix-only migration.

Representative files:

- `src/api/index.ts` (about 129 API modules)
- `src/api/fetchData.ts`
- `src/resources/scripts/endpoints.ts`
- `src/generated/userservice.d.ts`
- `src/generated/agencyservice.d.ts`

### Messaging Realtime

Matrix client lifecycle, end-to-end encryption, chat transport, message submission, uploads and attachments, and video calls. The `src/services/` directory concentrates the Matrix stack: client registry and service, crypto and key backup, device dehydration and isolation, interactive auth, live event bridge, room history key transfer, media content scanning, drafts, and call management. Video calls are embedded Element Call sessions driven through `matrix-widget-api`, with LiveKit as the media layer.

Representative files:

- `src/services/matrixClientService.ts`
- `src/services/matrixCrypto.ts`
- `src/services/matrixKeyBackupService.ts`
- `src/services/chatTransportService.ts`
- `src/services/CallManager.ts`
- `src/services/liveKitService.ts`
- `src/components/call/widget/useElementCallWidget.ts`
- `src/components/call/widget/OrisoWidgetDriver.ts`
- `src/components/messageSubmitInterface/TipTapComposer.tsx`
- `src/components/message/MessageAttachment.tsx`

### Feature Areas

Business feature screens and containers for bookings, registration, overview, profile, sessions, drafts, case handover, Erstantwort, and product-specific user flows.

Representative files:

- `src/components/profile/profile.routes.ts`
- `src/containers/bookings/booking.routes.ts`
- `src/containers/registration/`
- `src/components/sessionsList/SessionsList.tsx`
- `src/components/draftsCenter/`
- `src/components/caseHandover/`

### UI Components

Reusable React components (about 114 component directories), presentation modules, modals, forms, visual primitives, styles, and colocated Storybook stories.

Representative directories:

- `src/components/`
- component-local `.styles.scss`
- component-local `.stories.tsx`

### State Hooks Utilities

Global state, Jotai atoms, hooks, shared utilities, context helpers, and cross-cutting frontend behavior.

Representative files:

- `src/globalState/index.ts`
- `src/store/` (Jotai atoms)
- `src/hooks/useAppConfig.tsx`
- `src/components/app/TenantThemingLoader.tsx`
- `src/utils/`

### Transactional E-Mail Kit

A self-contained e-mail component kit under `src/emails/` (atoms to organisms to document, table layout, inlined tokens) with tone-variant content, Storybook previews, and build scripts that emit the committed `dist/` output, a packaged Keycloak e-mail theme, and MailService templates.

Representative files:

- `src/emails/README.md`
- `src/emails/kit/`
- `src/emails/scripts/buildEmails.mts`
- `src/emails/scripts/buildKeycloakTheme.mts`
- `src/emails/scripts/buildMailServiceTemplates.mts`

### Localization Styling Resources

Translations, i18n assets, static public assets, styling resources, and theming inputs. Locale bundles ship with the repository; an i18n catalogue guard test tracks key coverage.

Representative directories:

- `src/resources/`
- `src/i18n.ts` and `src/i18nCatalogueGuard.baseline.json`
- `public/`

### Tests Stories

Vitest unit and Storybook-project tests, Playwright smoke and cross-browser specs (including a browser-based Matrix crypto reload harness), Cypress e2e/component tests, and Storybook configuration.

Representative files:

- `vitest.config.mts`
- `playwright.config.ts` and `playwright/`
- `cypress.config.js` and `cypress/`
- `.storybook/main.ts`
- `scripts/run-storybook-tests.mjs`

### Build Tooling Config

Webpack app build, npm scripts, TypeScript settings, proxy server setup, linting, icon-catalog and call-theme generators, and package manifests (root plus `src/extensions/` and `proxy/`).

Representative files:

- `package.json`
- `config/webpack.config.js`
- `scripts/build.js`
- `scripts/start.js`
- `proxy/server.js`
- `tsconfig.json`
- `vite.matrix-smoke.config.ts`

### Deployment Infrastructure

Docker, Kubernetes, ingress, runtime config, and CI/CD delivery assets, including a dedicated Storybook image and deployment.

Representative files:

- `Dockerfile` and `Dockerfile.storybook`
- `deployment-v2.yaml`
- `ingress.yaml` and `ingress-v2.yaml`
- `storybook-deployment.yaml`
- `.github/workflows/` (`ci-pull-request.yml`, `ci-main.yml`, `ci-storybook-*.yml`, `frontend-deploy.yml`, `release-image.yml`, `ai-pr-review.yml`)

### Documentation

Repository docs, architecture notes, planning docs, engineering rules, and graph documentation.

Representative files:

- `README.md`
- `docs/README.md`
- `docs/architecture/current-architecture.md`
- `docs/rules/engineering-rules.md`
- `MATRIX-INTEGRATION-GUIDE.md`
- `.understand-anything/README.md`

## Main Relationships

- Files contain extracted function and class nodes through `contains` edges.
- Function-level dependencies are represented with `calls` edges.
- Documentation and cross-cutting associations are represented with `related` edges.

## API And Service Relationships

The frontend API boundary is local to `src/api/`, `src/generated/`, and `src/resources/scripts/endpoints.ts`. These files describe how browser flows call backend Online-Beratung services, but they are not the authoritative backend implementation. API compatibility changes should be reviewed against the backend service contracts. Chat and calls no longer go through generated message/video/live service typings; they run over the Matrix homeserver and LiveKit via the service layer.

## Auth Flow Relationship

Authentication-related evidence is concentrated in registration, session-cookie, and Matrix login modules. Key concerns include Keycloak logout, two-factor auth, invite link handling, anonymous sessions, session cookies, Matrix credential handover after login, and interactive auth for Matrix operations.

## Database Relationship

This repository does not contain the authoritative database model or migrations. Database-like evidence is limited to generated service typings, endpoint constants, and test fixtures that model backend payloads.

## Deployment Relationship

Deployment is represented by Docker, nginx/runtime config, Kubernetes YAML, and GitHub Actions workflows. These files show frontend and Storybook delivery wiring, but environment-specific behavior still needs verification against the target ORISO deployment environment.

## ORISO Ecosystem Fit

This graph is intentionally scoped to ORISO-Frontend. It records local evidence of backend APIs, auth, realtime communication, deployment, and tests, but it does not analyze sibling ORISO services.
