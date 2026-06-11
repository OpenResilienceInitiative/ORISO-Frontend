# Architecture Notes: ORISO-Frontend

## Purpose

Frontend application for the Online-Beratung platform, including registration, messaging, bookings, profile flows, and Matrix-backed real-time communication.

## Architecture Layers

### Api And Routing

HTTP routes, controllers, API clients, and request boundaries.

Key files:

- `cypress/support/commands/api/agencies.ts` - cypress/support/commands/api/agencies.ts is a code file under cypress; starts with "const agenciesApi = (cy, getWillReturn, setWillReturn) =".
- `cypress/support/commands/api/appointments.ts` - cypress/support/commands/api/appointments.ts is a code file under cypress; starts with "getAppointments,".
- `cypress/support/commands/api/consultTypes.ts` - cypress/support/commands/api/consultTypes.ts is a code file under cypress; starts with "const consultingTypesApi = (cy, getWillReturn, setWillReturn) =".
- `cypress/support/commands/api/messages.ts` - cypress/support/commands/api/messages.ts is a code file under cypress; starts with "/service/users/consultants/adsf-asdf-asdf".
- `cypress/support/commands/api/rc.ts` - cypress/support/commands/api/rc.ts is a code file under cypress; starts with "/service/users/consultants/adsf-asdf-asdf".
- `cypress/support/commands/api/topic.ts` - cypress/support/commands/api/topic.ts is a code file under cypress; starts with "const topicsApi = (cy, getWillReturn, setWillReturn) =".
- `cypress/support/commands/api/uploads.ts` - cypress/support/commands/api/uploads.ts is a code file under cypress; starts with "/service/users/consultants/adsf-asdf-asdf".
- `cypress/support/commands/api/users/chat.ts` - cypress/support/commands/api/users/chat.ts is a code file under cypress; starts with "/service/users/consultants/adsf-asdf-asdf".
- `cypress/support/commands/api/users/consultants.ts` - cypress/support/commands/api/users/consultants.ts is a code file under cypress; starts with "/service/users/consultants/adsf-asdf-asdf".
- `cypress/support/commands/api/users/data.ts` - cypress/support/commands/api/users/data.ts is a code file under cypress; starts with "const usersDataApi = (".
- `cypress/support/commands/api/users/sessions.ts` - cypress/support/commands/api/users/sessions.ts is a code file under cypress; starts with "const usersSessionsApi = (cy, getWillReturn, setWillReturn) =".
- `cypress/support/commands/api/videocalls.ts` - cypress/support/commands/api/videocalls.ts is a code file under cypress; starts with "const videocallsApi = (cy) =".

### Application Core

Core application code and shared utilities.

Key files:

- `.dockerignore` - .dockerignore is a code file under repository root in this repository.
- `.gitignore` - .gitignore is a code file under repository root; starts with "# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.".
- `.husky/.gitignore` - .husky/.gitignore is a code file under .husky in this repository.
- `.husky/commit-msg` - .husky/commit-msg is a code file under .husky in this repository.
- `.husky/pre-commit` - .husky/pre-commit is a code file under .husky in this repository.
- `.prettierignore` - .prettierignore is a code file under repository root in this repository.
- `.storybook-backup/main.ts` - .storybook-backup/main.ts is a code file under .storybook-backup; starts with "const config: StorybookConfig =".
- `.storybook-backup/static/compound-design-tokens.css` - .storybook-backup/static/compound-design-tokens.css is a markup file under .storybook-backup; starts with "/\* Establish a layer order that allows semantic tokens to be customized, but not base tokens.".
- `.storybook-backup/static/compound-web.css` - .storybook-backup/static/compound-web.css is a markup file under .storybook-backup; starts with "Copyright 2023 New Vector Ltd.".
- `.storybook-backup/static/cpd-common-base.css` - .storybook-backup/static/cpd-common-base.css is a markup file under .storybook-backup; starts with ":root, class\*="cpd-theme-"".
- `.storybook-backup/static/cpd-common-semantic.css` - .storybook-backup/static/cpd-common-semantic.css is a markup file under .storybook-backup; starts with ":root, class\*="cpd-theme-"".
- `.storybook-backup/static/cpd-font-fallbacks.css` - .storybook-backup/static/cpd-font-fallbacks.css is a markup file under .storybook-backup; starts with "/_ Fallback for Inter regular _/".

### Auth And Security

Authentication, authorization, Keycloak, and security-related code.

Key files:

- `src/globalState/interfaces/AuthDataInterface.ts` - src/globalState/interfaces/AuthDataInterface.ts is a code file under src; starts with "keycloakToken: string;".

### Configuration

Runtime, build, package, framework, and environment configuration.

Key files:

- `.cursor/settings.json` - .cursor/settings.json is a config file under .cursor in this repository.
- `.env.example` - .env.example is a config file under repository root; starts with "VITE_PORT=9002".
- `.github/actions/docker-build-push/action.yml` - .github/actions/docker-build-push/action.yml is a config file under .github; starts with "name: Reusable Docker Build and Publish steps".
- `.github/actions/node-build/action.yml` - .github/actions/node-build/action.yml is a config file under .github; starts with "name: Reusable Node Build steps".
- `cypress/fixtures/api.v1.login.json` - cypress/fixtures/api.v1.login.json is a config file under cypress; starts with ""status": "success",".
- `cypress/fixtures/auth.token.json` - cypress/fixtures/auth.token.json is a config file under cypress; starts with ""expires_in": 600,".
- `cypress/fixtures/registration/agency.json` - cypress/fixtures/registration/agency.json is a config file under cypress in this repository.
- `cypress/fixtures/registration/consultingType.json` - cypress/fixtures/registration/consultingType.json is a config file under cypress in this repository.
- `cypress/fixtures/registration/topic.json` - cypress/fixtures/registration/topic.json is a config file under cypress in this repository.
- `cypress/fixtures/releases.json` - cypress/fixtures/releases.json is a config file under cypress in this repository.
- `cypress/fixtures/service.agencies.json` - cypress/fixtures/service.agencies.json is a config file under cypress in this repository.
- `cypress/fixtures/service.agency.consultants.json` - cypress/fixtures/service.agency.consultants.json is a config file under cypress; starts with ""agencies": null,".

### Deployment And Operations

Docker, Kubernetes, CI/CD, infrastructure, and operational resources.

Key files:

- `.github/workflows/ci-feature-branch.yml` - .github/workflows/ci-feature-branch.yml is a pipeline file under .github; starts with "name: CI - Feature Branch".
- `.github/workflows/ci-main.yml` - .github/workflows/ci-main.yml is a pipeline file under .github; starts with "name: CI - Main".
- `.github/workflows/ci-pull-request.yml` - .github/workflows/ci-pull-request.yml is a pipeline file under .github; starts with "name: CI - Pull Request".
- `.github/workflows/ci-storybook-feature-branch.yml` - .github/workflows/ci-storybook-feature-branch.yml is a pipeline file under .github; starts with "name: CI - Storybook Feature Branch".
- `.github/workflows/ci-storybook-main.yml` - .github/workflows/ci-storybook-main.yml is a pipeline file under .github; starts with "name: CI - Storybook Main".
- `.github/workflows/ci-storybook-pull-request.yml` - .github/workflows/ci-storybook-pull-request.yml is a pipeline file under .github; starts with "name: CI - Storybook Pull Request".
- `.github/workflows/frontend-deploy.yml` - .github/workflows/frontend-deploy.yml is a pipeline file under .github; starts with "name: "ORISO Frontend Deploy"".
- `STORYBOOK_KUBERNETES.md` - STORYBOOK_KUBERNETES.md is a infra file under repository root; starts with "# Storybook and Kubernetes".
- `k8s-temp-frontend.yaml` - k8s-temp-frontend.yaml is a infra file under repository root; starts with "apiVersion: apps/v1".
- `k8s-temp-runtime-configmap.yaml` - k8s-temp-runtime-configmap.yaml is a infra file under repository root; starts with "apiVersion: v1".
- `Dockerfile` - Dockerfile is a infra file under repository root; starts with "ARG NODE_VERSION=18.16.1".

### Documentation

Human-facing documentation and project notes.

Key files:

- `CHANGELOG.md` - CHANGELOG.md is a docs file under repository root in this repository.
- `LICENSE.md` - LICENSE.md is a docs file under repository root; starts with "GNU AFFERO GENERAL PUBLIC LICENSE".
- `MATRIX-INTEGRATION-GUIDE.md` - MATRIX-INTEGRATION-GUIDE.md is a docs file under repository root; starts with "# Matrix Integration Guide".
- `PROJECT_KNOWLEDGE.md` - PROJECT_KNOWLEDGE.md is a docs file under repository root; starts with "# Project Knowledge".
- `README.md` - README.md is a docs file under repository root; starts with "# ORISO Frontend".
- `STORYBOOK_SETUP.md` - STORYBOOK_SETUP.md is a docs file under repository root; starts with "# Professional Storybook Setup".
- `cypress/fixtures/releaseNote.md` - cypress/fixtures/releaseNote.md is a docs file under cypress; starts with "**Feature Name**".
- `docs/README.md` - docs/README.md is a docs file under docs; starts with "# ORISO Frontend Docs".
- `docs/architecture/current-architecture.md` - docs/architecture/current-architecture.md is a docs file under docs; starts with "# Current Architecture".
- `docs/plan/README.md` - docs/plan/README.md is a docs file under docs; starts with "# Planning Guide".
- `docs/plan/master-roadmap.md` - docs/plan/master-roadmap.md is a docs file under docs; starts with "# Master Roadmap".
- `docs/plan/template-feature-plan.md` - docs/plan/template-feature-plan.md is a docs file under docs; starts with "# Feature Plan Template".

### Domain Services

Business service modules and orchestration logic.

Key files:

- `.storybook/manager.ts` - .storybook/manager.ts is a code file under .storybook; starts with "// Professional theme configuration".
- `src/components/serviceExplanation/ServiceExplanation.styles.scss` - src/components/serviceExplanation/ServiceExplanation.styles.scss is a markup file under src; starts with "$iconSize: 32px;".
- `src/components/serviceExplanation/ServiceExplanation.tsx` - src/components/serviceExplanation/ServiceExplanation.tsx is a code file under src; starts with "EnvelopeIcon,".
- `src/generated/agencyservice.d.ts` - src/generated/agencyservice.d.ts is a code file under src; starts with "declare namespace AgencyService".
- `src/generated/liveservice.d.ts` - src/generated/liveservice.d.ts is a code file under src; starts with "declare namespace LiveService".
- `src/generated/mailservice.d.ts` - src/generated/mailservice.d.ts is a code file under src; starts with "declare namespace MailService".
- `src/generated/messageservice.d.ts` - src/generated/messageservice.d.ts is a code file under src; starts with "declare namespace MessageService".
- `src/generated/uploadservice.d.ts` - src/generated/uploadservice.d.ts is a code file under src; starts with "declare namespace UploadService".
- `src/generated/userservice.d.ts` - src/generated/userservice.d.ts is a code file under src; starts with "declare namespace UserService".
- `src/generated/videoservice.d.ts` - src/generated/videoservice.d.ts is a code file under src; starts with "declare namespace VideoService".
- `src/globalState/provider/ActiveSessionProvider.tsx` - src/globalState/provider/ActiveSessionProvider.tsx is a code file under src; starts with "type ActiveSessionContextProps =".
- `src/globalState/provider/AgencySpecificProvider.tsx` - src/globalState/provider/AgencySpecificProvider.tsx is a code file under src; starts with "createContext,".

### User Interface

User-facing pages, components, views, and UI state.

Key files:

- `.storybook-backup/preview-head.html` - .storybook-backup/preview-head.html is a markup file under .storybook-backup; starts with "!-- Load Compound UI CSS from static directory --".
- `.storybook-backup/preview.tsx` - .storybook-backup/preview.tsx is a code file under .storybook-backup; starts with "// Compound styles loaded via preview-head.html".
- `.storybook/preview-head.html` - .storybook/preview-head.html is a markup file under .storybook; starts with "!-- Load Compound UI CSS from static directory --".
- `.storybook/preview.tsx` - .storybook/preview.tsx is a code file under .storybook; starts with "// Compound styles loaded via preview-head.html".
- `src/components/E2EEncryptionSupportBanner/E2EEncryptionSupportBanner.styles.scss` - src/components/E2EEncryptionSupportBanner/E2EEncryptionSupportBanner.styles.scss is a markup file under src; starts with ".encryption-banner".
- `src/components/E2EEncryptionSupportBanner/E2EEncryptionSupportBanner.tsx` - src/components/E2EEncryptionSupportBanner/E2EEncryptionSupportBanner.tsx is a code file under src; starts with "hasVideoCallAbility,".
- `src/components/E2EEncryptionSupportHelp/E2EEncryptionSupportHelp.styles.scss` - src/components/E2EEncryptionSupportHelp/E2EEncryptionSupportHelp.styles.scss is a markup file under src; starts with ".encryption-support".
- `src/components/E2EEncryptionSupportHelp/E2EEncryptionSupportHelp.tsx` - src/components/E2EEncryptionSupportHelp/E2EEncryptionSupportHelp.tsx is a code file under src; starts with "const t: translate = useTranslation();".
- `src/components/Page/index.tsx` - src/components/Page/index.tsx is a code file under src; starts with "interface PageProps".
- `src/components/Page/page.styles.scss` - src/components/Page/page.styles.scss is a markup file under src in this repository.
- `src/components/Switch/index.tsx` - src/components/Switch/index.tsx is a code file under src; starts with "interface SwitchProps extends ReactSwitchProps".
- `src/components/Switch/switch.module.scss` - src/components/Switch/switch.module.scss is a markup file under src in this repository.

## Major Flows

- Entry and boot flow: `Dockerfile`, `k8s-temp-frontend.yaml`, `k8s-temp-runtime-configmap.yaml`, `src/components/app/app.tsx`, `src/components/app/AuthenticatedApp.tsx`, `src/initApp.tsx`, `STORYBOOK_KUBERNETES.md`
- API/service flow: `cypress/fixtures/api.v1.login.json`, `cypress/fixtures/service.agencies.json`, `cypress/fixtures/service.agency.consultants.json`, `cypress/fixtures/service.consultingtypes.addiction.json`, `cypress/fixtures/service.consultingtypes.emigration.json`, `cypress/fixtures/service.consultingtypes.pregnancy.json`, `cypress/fixtures/service.consultingtypes.u25.json`, `cypress/fixtures/service.settings.json`, `cypress/fixtures/service.tenant.public.json`, `cypress/fixtures/service.topicGroups.json`, `cypress/fixtures/service.topics.json`, `cypress/fixtures/service.users.data.json`
- Configuration flow: `.cursor/settings.json`, `.env.example`, `.github/actions/docker-build-push/action.yml`, `.github/actions/node-build/action.yml`, `cypress/fixtures/api.v1.login.json`, `cypress/fixtures/auth.token.json`, `cypress/fixtures/registration/agency.json`, `cypress/fixtures/registration/consultingType.json`

## API And Service Dependencies

- `cypress/fixtures/api.v1.login.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.agencies.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.agency.consultants.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.consultingtypes.addiction.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.consultingtypes.emigration.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.consultingtypes.pregnancy.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.consultingtypes.u25.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.settings.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.tenant.public.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.topicGroups.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.topics.json` contributes API, service, route, client, or service-boundary behavior.
- `cypress/fixtures/service.users.data.json` contributes API, service, route, client, or service-boundary behavior.

## Authentication Relationship

- `.storybook-backup/static/compound-design-tokens.css` is auth/security-related by filename or path.
- `.storybook/static/compound-design-tokens.css` is auth/security-related by filename or path.
- `cypress/e2e/tokens.cy.ts` is auth/security-related by filename or path.
- `cypress/fixtures/auth.token.json` is auth/security-related by filename or path.
- `src/api/apiLogoutKeycloak.ts` is auth/security-related by filename or path.
- `src/api/apiTwoFactorAuth.ts` is auth/security-related by filename or path.
- `src/api/videocalls/getJwt.ts` is auth/security-related by filename or path.
- `src/components/app/authenticatedApp.styles.scss` is auth/security-related by filename or path.
- `src/components/app/AuthenticatedApp.tsx` is auth/security-related by filename or path.
- `src/components/auth/auth.ts` is auth/security-related by filename or path.
- `src/components/sessionCookie/getBudibaseAccessToken.ts` is auth/security-related by filename or path.
- `src/components/sessionCookie/getKeycloakAccessToken.ts` is auth/security-related by filename or path.

## Database Relationship

- `cypress/fixtures/service.consultingtypes.emigration.json` is database, schema, repository, entity, model, or migration-related by filename or path.

## Deployment Relationship

- `.github/workflows/ci-feature-branch.yml` participates in deployment, infrastructure, or CI/CD.
- `.github/workflows/ci-main.yml` participates in deployment, infrastructure, or CI/CD.
- `.github/workflows/ci-pull-request.yml` participates in deployment, infrastructure, or CI/CD.
- `.github/workflows/ci-storybook-feature-branch.yml` participates in deployment, infrastructure, or CI/CD.
- `.github/workflows/ci-storybook-main.yml` participates in deployment, infrastructure, or CI/CD.
- `.github/workflows/ci-storybook-pull-request.yml` participates in deployment, infrastructure, or CI/CD.
- `.github/workflows/frontend-deploy.yml` participates in deployment, infrastructure, or CI/CD.
- `Dockerfile` participates in deployment, infrastructure, or CI/CD.
- `k8s-temp-frontend.yaml` participates in deployment, infrastructure, or CI/CD.
- `k8s-temp-runtime-configmap.yaml` participates in deployment, infrastructure, or CI/CD.
- `STORYBOOK_KUBERNETES.md` participates in deployment, infrastructure, or CI/CD.

## ORISO Ecosystem Fit

`ORISO-Frontend` is one repository in the ORISO system. The graph focuses only on this repo's files and records cross-cutting evidence such as API, auth, database, and deployment files when those relationships are visible locally.
