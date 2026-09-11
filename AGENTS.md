# AGENTS.md

## Parent Router First

- This file is a repo-local supplement for `ORISO-Frontend`.
- In the ORISO multi-repo Cursor workspace, load the parent map at `../AGENTS.md` first.
  `PROJECT_ORISO_ROOT` is that parent directory (sibling of this repo).
- If this repository is cloned alone (no parent workspace), skip `../AGENTS.md` and use this file plus the commands below.
- Keep durable cross-project ORISO rules in the parent workspace `AGENTS.md`, `ARCHITECTURE.md`, and parent `.cursor/` skills/agents — not duplicated here.

## Orchestration

- For non-trivial tasks, or whenever the user says "loop", run the `goal-loop` skill: intake → plan → iterate think/implement/verify until acceptance criteria pass → regression-check → pr-prep.
- **New** task docs: `docs/agent-tasks/YYYY-MM-DD_short-feature-name/`. Legacy folders under `docs/cursor-orchestrator/` are historical — do not add new tasks there.
- Delegate broad exploration to the `codebase-explorer` subagent, planning to `planner`, post-implementation validation to `verifier`, and touched-scope security review to `security-auditor`.
- Stop for confirmation before: credentials, external service setup, destructive commands, and opening/updating a PR.
- Capture reusable lessons in `.learnings/LEARNINGS.md`; promote to this file only if broadly applicable.

## Context First

- Treat `pre-dev` as the normal integration branch for ORISO feature PRs unless the task says otherwise. Keep `dev` stable for QA, as defined by the parent ORISO map.
- Before non-trivial changes, skim `.understand-anything/README.md`, `.understand-anything/ARCHITECTURE.md`, and `.understand-anything/knowledge-graph.json` for fast repo context.
- Use `CONTEXT.md` for Activity Timeline and notification vocabulary; avoid inventing parallel terms.

## Frontend Rules

- Keep behavior in shared hooks/utilities when multiple screens need the same state, route, selection, or formatting logic.
- Reuse existing design tokens, Sass mixins, and component patterns. Avoid one-off hardcoded CSS for controls, active list states, focus rings, and responsive layout.
- Preserve Matrix/chat/draft privacy boundaries. Do not move plaintext previews or draft contents into server-visible state.
- UI changes need accessible focus/keyboard behavior and should not rely on color alone.

## Validation

- Prefer red-green TDD for behavior changes: add or update the smallest test that would fail without the fix, then implement.
- Useful commands (CI Node **18**; install with `npm ci --legacy-peer-deps`):
    - `npm run test:unit`
    - `npm run lint:scripts`
    - `npm run lint:style`
    - `npm run build`
- From this repository root (multi-repo workspace only):
  `REPO=ORISO-Frontend ../scripts/harness/verify-fast.sh` (or `verify-full.sh`).
- From `PROJECT_ORISO_ROOT`:
  `REPO=ORISO-Frontend ./scripts/harness/verify-fast.sh`.
- Standalone Frontend clone: use the `npm run …` commands above (no workspace harness).
- **Hard gate before opening a PR:** `npm run test:unit`, `npm run lint:scripts`, `npm run lint:style`, and `npm run build` must pass. A PR without this passing output is not done.
- For changes that need a running backend, use the canonical repo integration tests plus any workspace e2e flow that actually exists — do not cite `make verify` unless a real Makefile is added.
- The narrowest-relevant-command shortcut applies to intermediate iterations only. If the final gate is blocked by pre-existing unrelated failures, state the blocker precisely in the PR body.

## Review Expectations

- Cursor should compare PRs against `origin/pre-dev` for normal ORISO feature work.
- CodeRabbit is optional/manual and should not be treated as the primary automated reviewer.
- Automated review should flag missing tests, duplicated UI architecture, unsafe privacy changes, and mergeability risks.
- Only auto-fix issues that are clearly scoped and testable. Leave architectural or ambiguous changes as review comments.

## AI agent delivery rules

Binding for every AI coding agent working in this repository. Canonical text and
rationale: `ORISO-Docs/oriso-platform/coding-standards.mdx` (section "AI agent
delivery rules"). Summary:

- **An agent never merges its own pull request.** Not on green CI, not on "finish
  it", not for chores or test-only changes. Delivery ends at: verified → PR open
  with evidence and a reviewer test plan → reviewers requested → issue
  `In review`. Merge only on an explicit, per-PR instruction naming that PR.
- **Request reviewers in the same step that opens the PR.** A PR without
  requested reviewers is not open for review.
- **"Pre-Dev is free" means the server, not the branch.** Deploying images,
  mutating config or data and running E2E on the Pre-Dev server needs no
  approval; the `pre-dev` *branch* is review-gated like any shared branch.
- **Restore what you borrowed.** Record image reference *and* `imagePullPolicy`
  before swapping anything on Pre-Dev, put both back before reporting done, and
  say so in the report.
- **State where it was verified** in every PR body — environment and image, or
  plainly "local only".
