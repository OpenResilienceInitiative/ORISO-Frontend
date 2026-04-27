# Master Roadmap

This roadmap captures the highest-value implementation priorities based on the current frontend architecture. It is a planning aid, not a release promise.

## Priority Themes

### 1. Reduce Startup Coupling

Primary target:

- `src/components/app/AuthenticatedApp.tsx`

Desired direction:

- split bootstrap responsibilities into smaller hooks or service-backed flows
- keep auth startup readable and testable
- isolate Matrix bootstrap from unrelated UI initialization

Why this matters:

- this is one of the highest-risk files for regressions
- new feature work becomes slower when startup logic keeps growing

### 2. Contain Migration Complexity

Primary targets:

- API compatibility logic
- Matrix services
- call and live-event bridges

Desired direction:

- keep Matrix and Rocket.Chat crossover behavior behind clear service and API boundaries
- reduce transport-specific leakage into feature UI
- make future migration cleanup possible without touching many screens

Why this matters:

- transport compatibility is easy to duplicate accidentally
- this is a major source of hidden complexity

### 3. Improve State Boundaries

Primary targets:

- `src/globalState`
- provider-heavy feature flows

Desired direction:

- audit which concerns truly need global context
- prefer feature-local hooks and state when possible
- reduce the surface area of oversized shared state

Why this matters:

- large provider graphs increase coupling and make ownership harder to track

### 4. Normalize API Organization

Primary target:

- `src/api`

Desired direction:

- gradually organize calls by domain while preserving behavior
- keep request setup centralized
- make endpoint discovery easier for contributors

Why this matters:

- the current API layer is large and easy to navigate incorrectly

### 5. Raise Documentation Fidelity

Primary targets:

- root docs
- `docs/` canonical pages

Desired direction:

- keep architecture and workflow docs aligned with real implementation
- reduce conflicting descriptions of stack and setup

Why this matters:

- inaccurate docs slow down onboarding and cause poor implementation choices

## Suggested Sequencing

Use this order when multiple roadmap items are active:

1. documentation fidelity
2. startup coupling reduction
3. migration-complexity containment
4. API normalization
5. provider-surface cleanup

Reasoning:

- clean docs improve all later work
- startup and migration concerns carry the highest regression risk
- structural cleanup is safer after the core boundaries are documented

## Architectural Dependencies

- Startup refactors should respect current routing and authentication flow.
- Migration cleanup should preserve backend compatibility behavior until the repo is ready to remove it intentionally.
- API reorganization should not bypass `fetchData.ts` conventions.
- State-boundary improvements should avoid creating a second competing global-state pattern.

## Risk Hotspots

Take extra care when changes touch:

- authenticated bootstrap
- websocket startup
- Matrix client initialization
- call state and live-event bridging
- cookie and auth header behavior
- route shell behavior in `src/components/app/app.tsx`

## Delivery Guidance

- favor controlled, narrow refactors over big-bang rewrites
- attach a feature plan to any roadmap item that spans multiple files or behaviors
- update the architecture and rules docs when a roadmap item changes repo conventions
