---
name: goal-loop
description: Autonomous convergence loop that takes a goal from problem statement to verified, PR-ready code. Iterates think, implement, verify, diagnose until acceptance criteria pass or a blocker needs the user. Use when the user says "loop", "goal-loop", "run the loop", "keep going until it works", or gives a task and asks the agent to iterate until done.
---

# Goal Loop

Run the whole loop in one turn. Do not stop between iterations to ask "shall I continue?" — only stop at the exit conditions below.

## Setup (once, before iteration 1)

1. Normalize the goal with the `problem-intake` skill → `00-problem-brief.md`. The acceptance criteria in that brief are the loop's exit test. If the goal is one sentence, write criteria yourself from context; ask the user only for genuinely blocking unknowns.
2. If non-trivial (more than one file, new behavior, UI, security, or unclear requirements): run the `planner` subagent → `01-spike.md` and `02-implementation-plan.md` (see `spike-doc` and `task-implementation-doc` skills).
3. Git: check `git status`; confirm with user if the tree is dirty. Branch from `dev` as `cursor/<ticket-or-feature>/<short-slug>`. Never implement on `dev`.
4. Create `03-progress-log.md` with the iteration table (template below).

## Iteration protocol

Repeat THINK → IMPLEMENT → VERIFY → DECIDE.

**THINK**

- Iteration 1: pick the first unchecked criterion or subtask from the plan.
- Iteration >1: read the failure output from the last VERIFY. Diagnose the root cause before touching code — state the hypothesis in one line in the progress log. If the same failure has appeared twice, the hypothesis must be different from the last one; re-read the surrounding code instead of re-trying the same fix.

**IMPLEMENT**

- Smallest coherent change that addresses the current criterion or failure. Touch only files the task requires.
- Prefer red-green: write/adjust the failing test first when adding behavior (per AGENTS.md).

**VERIFY**

- Narrowest check first: the specific vitest file(s) for touched code, then `npm run lint:scripts` / `npm run lint:style` on style changes, `npm run build` only when imports/config/types changed broadly.
- For UI changes, use Browser verification and save screenshots to the task folder.
- Never paste long logs into the conversation; summarize failures in the progress log.

**DECIDE**

- All acceptance criteria met and checks green → exit loop, go to Finish.
- Failures remain → append one progress-log entry and return to THINK.
- Same failure 3 consecutive iterations, or 10 iterations total → STOP and report the blocker with your best diagnosis. Do not thrash.
- Need credentials, destructive commands, external service setup → STOP and ask.

## Progress log entry format

One short block per iteration in `03-progress-log.md`:

```markdown
### Iteration N — <status: pass|fail|blocked>

- Target: <criterion or failing check>
- Hypothesis: <one line, iterations >1 only>
- Change: <files touched, one line>
- Verify: <command run → result summary>
```

## Finish

1. Run the `regression-check` skill on touched areas → `04-test-evidence.md`.
2. If auth, input handling, storage, network, or privacy boundaries were touched: run the `security-auditor` subagent → `05-security-review.md`.
3. Run the `pr-prep` skill → `06-pr-summary.md`.
4. Record any reusable lesson in `.learnings/LEARNINGS.md` (one concept per entry, keep short).
5. STOP for user confirmation before opening or updating a PR.

## Artifacts

All docs live in `docs/agent-tasks/YYYY-MM-DD_short-feature-name/` (legacy `docs/cursor-orchestrator/` is historical only). Reference file paths; do not copy large file contents into docs.
