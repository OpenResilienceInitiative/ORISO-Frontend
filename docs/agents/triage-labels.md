# Triage labels

This adapter records labels verified on 2026-10-16. Recheck the live vocabulary before a mutation. Setup does not create or rename remote labels.

| Skill role        | Existing tracker label | Behavior                                          |
| ----------------- | ---------------------- | ------------------------------------------------- |
| `needs-triage`    | `needs triage`         | Use this exact existing label when authorized.    |
| `needs-info`      | Not mapped             | Leave labels unchanged; report the unmapped role. |
| `ready-for-agent` | `ready-for-agent`      | Use this exact existing label when authorized.    |
| `ready-for-human` | Not mapped             | Leave labels unchanged; report the unmapped role. |
| `wontfix`         | `wontfix`              | Use this exact existing label when authorized.    |

An unmapped role is not an alternative spelling or permission to create a label. Preserve the issue's current labels and report the missing mapping; do not claim a readiness state from an absent label. Follow native project fields and lifecycle rules in `${PROJECT_ORISO_ROOT}/0 - Docs/issue-task-workflow.md` when applicable. `question` and `help wanted` are not assumed to mean agent/human readiness.
