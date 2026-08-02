---
name: spike-doc
description: Analyze existing implementation and produce a concise spike document before coding a non-trivial change. Use after problem intake when the task touches multiple files, new behavior, architecture, or unclear code paths.
---

# Spike Document

Create `01-spike.md` in the current task folder under `docs/agent-tasks/`.

Before writing, analyze the existing implementation:

- Use the `codebase-explorer` subagent (or Explore) for broad searches; keep raw search results out of the main context.
- Skim `.understand-anything/ARCHITECTURE.md` and `graphify-out/GRAPH_REPORT.md` for structure before reading raw files.
- Reuse existing patterns, hooks, tokens, and mixins before inventing new abstractions.

Structure (keep each section short, file-oriented, no narrative essays):

- **Current behavior**: how it works today, with file paths and line references
- **Root cause / gap**: for bugs, the diagnosed cause; for features, what's missing
- **Approach**: the chosen approach and one line on why over the obvious alternative
- **Files likely to change**: bullet list of paths with one-line intent each
- **Risks and edge cases**
- **Test strategy**: which existing tests cover this area, what new tests are needed
