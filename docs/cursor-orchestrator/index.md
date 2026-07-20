# Cursor Orchestrator — Task Log

One folder per task: `YYYY-MM-DD_short-feature-name/`. Author, branch, ticket links, and status go inside the files, not the folder name.

Standard files per task (created as needed, not all are mandatory):

| File                        | Produced by                            | Purpose                                     |
| --------------------------- | -------------------------------------- | ------------------------------------------- |
| `00-problem-brief.md`       | `problem-intake` skill                 | Goal + acceptance criteria (loop exit test) |
| `01-spike.md`               | `planner` subagent / `spike-doc` skill | Current behavior, root cause, approach      |
| `02-implementation-plan.md` | `task-implementation-doc` skill        | Subtask table driving loop iterations       |
| `03-progress-log.md`        | `goal-loop` skill                      | One short entry per loop iteration          |
| `04-test-evidence.md`       | `regression-check` skill               | Final verification results                  |
| `05-security-review.md`     | `security-auditor` subagent            | Touched-scope security findings             |
| `06-pr-summary.md`          | `pr-prep` skill                        | PR-ready package                            |

## Tasks

<!-- newest first: [YYYY-MM-DD_slug](YYYY-MM-DD_slug/00-problem-brief.md) — one-line status -->
