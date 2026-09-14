# 00 — Problem brief: why the Timeline still does not feel done, and a configurable display filter

- **Requested by:** Frank (product), 2026-09-14
- **Branch:** `claude/timeline-analysis-filter-il7z7b` (based on `origin/dev` @ `31dac29b`)
- **Scope of this task:** analysis + specification only. No behaviour change ships from this branch.
- **Related:** #1200 (closed, QA lane), #592 / #594 (open: display filters), #420 (open: real chat preview), #1211 (notification matrix), ORISO-Docs PR #108 (ADR "Activity Timeline", still Proposed)

## The complaint, as stated

1. Email and the announcement system are now in place, but the Timeline (Zeitstrahl) still does not work "the way it should".
2. Expectation from Slack's Activity view: the conversation is visible **on the right, immediately**, and can be worked in place. Today one can click into an item and there are extra buttons to jump to the real chat room, but the right pane only does this for some items and the jump leaves the Timeline.
3. Wanted in addition: a small, global piece of logic that makes the **display filter user-programmable** — per section (Anfragen, Gespräche, Zeitstrahl) and globally. The user hides what they do not want to see; hidden items are (configurably) marked as read straight away. Entry point: one minimalist filter button at the right end of the chip row below the search field.

## Deliverables

- [01-analysis.md](01-analysis.md) — what is verifiably not working or insufficient on `dev` @ `31dac29b`, with file references, root causes and what is a product decision vs a defect.
- [02-filter-spec.md](02-filter-spec.md) — the specification for the configurable display filter (global + per section), written against the existing docs (`CONTEXT.md`, #592, #420, ADR draft in ORISO-Docs PR #108) so that nothing is invented twice.
- GitHub issue [#1377](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1377) carries the spec and links this analysis.

## Method

Read the code on `dev` first, then the docs (`CONTEXT.md`, `docs/agent-tasks/2026-09-05_issue-1200-timeline-view/*`, `docs/agent-tasks/2026-09-06_issue-1211-notification-matrix/*`), then the open issues. Every claim in the analysis names the file and line it was read from. Nothing was verified on Pre-Dev in a browser — this is a code-level analysis, and it says so where a live check is still needed.
