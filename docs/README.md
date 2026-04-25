# ORISO Frontend Docs

This `docs/` directory is the canonical documentation hub for the ORISO frontend. It is the source of truth for architecture, implementation rules, approved workflows, and planning standards.

## Read This First

Recommended reading order:

1. [Architecture](./architecture/current-architecture.md)
2. [Engineering Rules](./rules/engineering-rules.md)
3. [Implementation Skills](./skills/implementation-skills.md)
4. [Planning Guide](./plan/README.md)
5. [Master Roadmap](./plan/master-roadmap.md)

## What Lives Here

- `architecture/`: how the frontend is actually structured today
- `rules/`: repo-specific engineering principles and implementation rules
- `skills/`: approved, currently usable skills and workflows for this repo
- `plan/`: how to plan implementation work before editing code

## Update Rules

Use these rules whenever the repo changes:

- Update docs in the same workstream whenever architecture, stack truth, or implementation conventions change.
- Prefer correcting one canonical doc instead of duplicating the same guidance in multiple places.
- Keep docs tied to the real codebase, not aspirational future architecture.
- When a change affects planning or implementation workflow, update `docs/plan` or `docs/rules` before the work is considered complete.

## Ownership

These docs are shared engineering docs. Any contributor who changes architecture, build/runtime behavior, or implementation conventions is responsible for updating the relevant page here.
