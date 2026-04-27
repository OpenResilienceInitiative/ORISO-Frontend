# Engineering Rules

This page defines how we should implement and review code in this repository. These rules are repo-specific. They are intended to make delivery safer and reduce accidental complexity.

## Core Principles

### SOLID

Use SOLID here as a practical decision framework, not as abstract theory.

- Single Responsibility: components render UI; hooks coordinate one slice of behavior; services manage long-lived integrations; API modules own backend request logic.
- Open/Closed: extend behavior through composition, feature hooks, and route fragments instead of growing central switch files.
- Liskov Substitution: UI should depend on stable domain behavior such as "load sessions" or "join call", not on whether Matrix or Rocket.Chat is behind it.
- Interface Segregation: avoid giant context contracts when consumers only need a small subset of data.
- Dependency Inversion: UI should depend on hooks and service boundaries, not on raw `window`, cookies, or transport details.

### DRY

Do not duplicate knowledge. In this repo, the most dangerous duplication is:

- auth and token behavior
- request header logic
- Matrix and Rocket.Chat compatibility rules
- route constants
- session and booking data transforms
- notification side effects

Duplicate simple markup only when it keeps features readable. Do not duplicate integration rules or backend behavior.

### YAGNI

Keep new work in the smallest reasonable scope.

- do not add new abstraction layers before two real use cases justify them
- do not add another state-management strategy unless the current one is clearly blocking delivery
- do not over-generalize a feature before it is proven to repeat

### KISS

Prefer explicit, understandable control flow over clever abstractions.

- use small named helpers for complex side effects
- keep async orchestration readable
- choose obvious file names and stable folder conventions

### Separation Of Concerns

Use these boundaries consistently:

- `components/`: rendering and interaction
- `containers/`: feature composition and page-level coordination
- `hooks/`: reusable feature or UI behavior
- `api/`: backend request functions
- `services/`: stateful client-side integrations
- `utils/`: pure or mostly pure helpers
- `globalState/`: cross-cutting app-wide state

## Where New Code Should Live

### Use A Component When

- the main responsibility is rendering UI
- the code handles local interaction and presentation
- the logic is tied directly to visual behavior

Do not put transport setup, cookie manipulation, or repeated backend orchestration into presentational components.

### Use A Hook When

- the behavior is reusable across components
- the logic coordinates one concern such as loading, subscriptions, filtering, or browser integration
- the behavior improves readability by removing side effects from a component

### Use A Provider When

- the state is truly shared across unrelated parts of the app
- local state, props, or feature-level hooks are no longer sufficient
- the concern is cross-cutting and long-lived

Before adding a provider, ask whether the state can stay inside a feature boundary.

### Use A Service When

- the code manages a stateful integration
- the logic needs a lifecycle outside a single render tree
- the behavior interacts with Matrix, calls, live events, or other long-lived client systems

### Use A Utility When

- the code is pure or mostly pure
- the output depends mainly on the input
- the behavior has no ownership of UI or long-lived app state

## Current Anti-Patterns To Avoid

These issues are already visible in the repo and should not spread further:

- adding more responsibilities to `src/components/app/AuthenticatedApp.tsx`
- letting `src/components/app/app.tsx` absorb feature logic instead of orchestration
- placing backend logic directly inside components
- spreading Matrix or Rocket.Chat compatibility behavior across feature UI
- creating new backup or alternate source files such as `.backup`, `OLD`, `FINAL`, or `BROKEN`
- documenting future aspirations instead of current implementation truth

## Implementation Guidance For This Repo

- Add new backend calls through `src/api`.
- Keep stateful transport and event logic in `src/services`.
- Prefer feature hooks before creating new global context.
- Keep route and startup behavior readable and explicit.
- When refactoring, reduce coupling at the highest-pressure seams first: authenticated startup, provider sprawl, and migration compatibility paths.

## Planning Rule

Meaningful feature work and risky refactors should have a plan in `docs/plan/` before code changes begin.

Use a plan when:

- a change touches multiple subsystems
- behavior changes across routing, startup, state, or integrations
- the work includes refactoring and not just a small bug fix
- the implementation path is not obvious from one file

## Documentation Update Rule

Documentation is part of the implementation.

Whenever you change:

- architecture
- stack/tooling truth
- implementation conventions
- planning workflow
- approved repo workflows or skills

you must update the relevant canonical doc under `docs/` in the same workstream.
