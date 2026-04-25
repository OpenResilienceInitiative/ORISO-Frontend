# Planning Guide

`docs/plan/` is the canonical location for implementation planning in this repository.

## When A Plan Is Required

Create a plan before implementation when the work:

- spans multiple subsystems
- changes architecture or implementation conventions
- touches startup, routing, global state, or real-time integrations
- includes non-trivial refactoring
- is large enough that another engineer should be able to implement it from the plan alone

Small, isolated fixes do not need a formal plan if the change is obvious and low-risk.

## What "Decision Complete" Means

A plan is decision complete when the implementer does not need to invent missing decisions about:

- goal and success criteria
- current state
- implementation approach
- affected areas
- testing expectations
- key constraints and assumptions

If the implementer still has to choose the structure, scope, or acceptance criteria, the plan is not complete.

## Required Sections For Plan Files

Every feature or initiative plan should include:

- `Summary`
- `Current State`
- `Proposed Changes`
- `Testing`
- `Risks / Assumptions`

You may add more sections when the work needs them, but these five are the minimum.

## File Naming Convention

Use this file name format for new plan files:

`YYYY-MM-DD-short-topic.md`

Examples:

- `2026-04-24-authenticated-startup-refactor.md`
- `2026-04-24-matrix-call-cleanup.md`

## Files In This Folder

- `master-roadmap.md`: repo-wide priorities and sequencing guidance
- `template-feature-plan.md`: the required template for new plans

## Planning Rules

- Keep plans tied to the actual repo structure.
- Prefer behavior-level descriptions over generic architecture language.
- Mention files only when needed to disambiguate the work.
- Update or replace outdated plans when architecture changes make them stale.
