# Current Architecture

This page documents the frontend as it exists in the current repository. It should reflect implementation truth, not future-state ideas.

## Stack Snapshot

- React + TypeScript application
- Custom webpack build and dev flow
- `react-router-dom` v5 routing patterns
- SCSS-first styling with some CSS modules and MUI theming
- Storybook for isolated UI work
- Cypress for end-to-end and component testing
- Provider-heavy shared state under `src/globalState`
- Centralized API helpers under `src/api`
- Stateful integration services under `src/services`

Important repo anchors:

- app bootstrap: `src/initApp.tsx`
- app shell: `src/components/app/app.tsx`
- authenticated startup: `src/components/app/AuthenticatedApp.tsx`
- route config: `src/components/app/RouterConfig.tsx`
- provider composition: `src/globalState/state.tsx`
- app config: `src/resources/scripts/config.ts`
- shared fetch helper: `src/api/fetchData.ts`
- call state service: `src/services/CallManager.ts`

## Application Flow

### Bootstrap

`src/initApp.tsx` initializes the app by:

- loading polyfills and global styles
- creating the React root
- mounting the `App` shell
- providing the MUI theme
- adding registration and legal-page routes

### App Shell

`src/components/app/app.tsx` is the main orchestration layer. It composes:

- top-level error handling
- app config, tenant, locale, and language providers
- legal links and global component context
- router setup and route branching
- websocket startup gating
- notifications and call widgets

This file is orchestration-heavy and should stay focused on composition rather than business logic.

### Authenticated Startup

`src/components/app/AuthenticatedApp.tsx` currently handles a large startup surface:

- token refresh
- user profile loading
- consulting types loading
- locale and informal-language setup
- notification reset and permission flow
- Matrix bootstrap
- Rocket.Chat compatibility providers
- group chat join behavior

This is one of the highest-coupling areas in the repo.

## State And Data Boundaries

### Global State

Shared state is composed through nested providers in `src/globalState/state.tsx`.

The current provider graph includes concerns such as:

- user data
- sessions data
- consulting types
- topics
- notifications
- modal state
- agency-specific state
- websocket-related state
- Rocket.Chat global settings

This architecture favors React context over a single external store.

### API Layer

`src/api` is the main backend-access boundary.

Current characteristics:

- endpoint-oriented API files
- shared request mechanics via `src/api/fetchData.ts`
- cookie- and auth-aware request behavior
- error-handling conventions shared through the fetch helper

New backend calls should be added here rather than inside UI components.

### Services Layer

`src/services` contains longer-lived, stateful client-side integration logic.

Current examples include:

- Matrix client lifecycle
- message and live-event bridging
- direct and group call handling
- draft and event-emitter behavior

Services are the right place for integration state machines and cross-session client behavior.

## Major Feature Areas

The current codebase is organized around these main business areas:

- registration: `src/components/registration`, `src/containers/registration`
- sessions/chat: `src/components/session`, `src/components/message`, `src/components/sessionsList`
- bookings: `src/containers/bookings`, `src/components/appointment`
- profile/settings: `src/components/profile`
- calls/video: `src/components/videoCall`, `src/components/videoConference`, `src/components/call`, `src/components/matrixCall`
- overview/dashboard: `src/containers/overview`

## Build And Tooling Reality

The repo currently uses a custom webpack pipeline, not Vite.

Relevant anchors:

- dev entry: `scripts/start.js`
- build entry: `scripts/build.js`
- webpack config: `config/webpack.config.js`
- dev server config: `config/webpackDevServer.config.js`
- storybook: `.storybook/`

Important npm scripts from `package.json`:

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run storybook`

## Integrations

The frontend currently integrates with:

- backend REST APIs
- Matrix
- Rocket.Chat compatibility paths still present during migration
- Keycloak-style token and session handling
- Jitsi and LiveKit-related dependencies
- Cal.com embedding
- browser notifications

## Known Architectural Risks

### Matrix And Rocket.Chat Crossover

The repo still contains migration-era compatibility behavior. For example, `src/api/fetchData.ts` still supports Rocket.Chat-compatible headers for backend compatibility.

Guidance:

- keep migration shims near APIs and services
- do not spread transport-specific compatibility logic across UI files

### Heavy Startup Coupling

The authenticated startup path owns many unrelated responsibilities.

Guidance:

- new startup behavior should prefer dedicated hooks or services
- avoid extending `AuthenticatedApp.tsx` unless the behavior truly belongs there

### Large Provider Surface

Many cross-cutting concerns are globalized through providers.

Guidance:

- add new global context only when the concern is truly app-wide
- prefer feature-local state and hooks first

### Documentation Drift

Some root docs previously described a Vite-based app even though the repo is webpack-based.

Guidance:

- treat docs as code
- update the canonical docs when implementation truth changes

### Search Noise In Source

There are backup and alternate files inside `src` such as `.backup`, `OLD`, and other variants.

Guidance:

- avoid adding new backup files into production source folders
- use git history and focused branches instead
