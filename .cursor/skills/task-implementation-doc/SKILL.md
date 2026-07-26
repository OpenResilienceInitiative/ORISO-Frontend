---
name: task-implementation-doc
description: Create a compact implementation plan with subtasks, status, and verification checklist that drives the goal-loop iterations. Use after the spike is done and before implementation starts.
---

# Task Implementation Document

Create `02-implementation-plan.md` in the current task folder.

Structure:

- **Objective**: one line
- **Impacted files**: paths only
- **Subtasks**: table with columns `#`, `Subtask`, `Files`, `Verify with`, `Status`
    - Each subtask must be small enough for one loop iteration and have a concrete verify command (e.g. `npx vitest run src/foo.test.ts`)
    - Status values: `todo`, `doing`, `done`, `blocked`
- **Verification checklist**: which of `npm run test:unit`, `lint:scripts`, `lint:style`, `build`, Browser check apply to this task
- **Risks**

Update the Status column as the loop progresses — this file is the loop's source of truth for what's next.
