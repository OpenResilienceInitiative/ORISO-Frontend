# AGENTS.md

## Parent Router First

- This file is a repo-local supplement for `${PROJECT_ORISO_ROOT}/ORISO-Frontend`.
- Before using these repo-specific rules, load `${PROJECT_ORISO_ROOT}/AGENTS.md` and the ORISO parent project files it points to. Resolve `PROJECT_ORISO_ROOT` through the machine-local routing configuration described by the parent router.
- Keep durable cross-project ORISO rules in the parent project files or parent `skills/`, not in this repo-local supplement.

## Orchestration

- For non-trivial tasks, or whenever the user says "loop", run the `goal-loop` skill: intake → plan → iterate think/implement/verify until acceptance criteria pass → regression-check → pr-prep. Task docs live in `docs/cursor-orchestrator/YYYY-MM-DD_short-feature-name/`.
- Delegate broad exploration to the `codebase-explorer` subagent, planning to `planner`, post-implementation validation to `verifier`, and touched-scope security review to `security-auditor`.
- Stop for confirmation before: credentials, external service setup, destructive commands, and opening/updating a PR.
- Capture reusable lessons in `.learnings/LEARNINGS.md`; promote to this file only if broadly applicable.

## Context First

- Treat `pre-dev` as the normal integration branch for ORISO feature PRs unless the task says otherwise. Keep `dev` stable for QA, as defined by the parent ORISO router.
- Before non-trivial changes, skim `.understand-anything/README.md`, `.understand-anything/ARCHITECTURE.md`, and `.understand-anything/knowledge-graph.json` for fast repo context.
- Use `CONTEXT.md` for Activity Timeline and notification vocabulary; avoid inventing parallel terms.

## Frontend Rules

- Keep behavior in shared hooks/utilities when multiple screens need the same state, route, selection, or formatting logic.
- Reuse existing design tokens, Sass mixins, and component patterns. Avoid one-off hardcoded CSS for controls, active list states, focus rings, and responsive layout.
- Preserve Matrix/chat/draft privacy boundaries. Do not move plaintext previews or draft contents into server-visible state.
- UI changes need accessible focus/keyboard behavior and should not rely on color alone.

## Validation

- Prefer red-green TDD for behavior changes: add or update the smallest test that would fail without the fix, then implement.
- Useful commands:
    - `npm run test:unit`
    - `npm run lint:scripts`
    - `npm run lint:style`
    - `npm run build`
- **Hard gate before opening a PR:** `npm run test:unit`, `npm run lint:scripts`, `npm run lint:style`, and `npm run build` must pass. A PR without this passing output is not done.
- For changes that need a running backend, use the canonical repo integration tests plus the parent `oriso-e2e-quality-gate` flow. There is currently no workspace-root `Makefile`; do not cite `make verify` as an available gate until a real harness is added and routed by the parent project.
- The narrowest-relevant-command shortcut applies to intermediate iterations only. If the final gate is blocked by pre-existing unrelated failures, state the blocker precisely in the PR body.

## Review Expectations

- Cursor should compare PRs against `origin/pre-dev` for normal ORISO feature work.
- CodeRabbit is optional/manual and should not be treated as the primary automated reviewer.
- Automated review should flag missing tests, duplicated UI architecture, unsafe privacy changes, and mergeability risks.
- Only auto-fix issues that are clearly scoped and testable. Leave architectural or ambiguous changes as review comments.
