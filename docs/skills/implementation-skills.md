# Implementation Skills

This page documents the skills and workflows that are currently usable and relevant for this repository. It is intentionally strict: only include skills that are actually available in this environment or are already supported by the repo workflow.

## How To Use This Page

- Prefer the repo's own engineering rules first.
- Use skills to accelerate specific tasks, not to replace architectural judgment.
- Do not assume a skill exists just because it would be useful; if it is not available here, it is not part of the approved workflow.

## Repo-Proven Default Workflow

For normal frontend work in this repo:

1. read the architecture and engineering rules
2. inspect the target feature area and nearby APIs/services
3. make code changes in the narrowest reasonable scope
4. verify behavior with lint, tests, Storybook, or local browser checks as appropriate
5. update docs when implementation truth changes

## Available Skills And Plugins

### `browser-use:browser`

Use when:

- checking local UI behavior in the in-app browser
- verifying routes, layouts, and interactive flows
- testing localhost pages after frontend changes

Do not use when:

- the task is purely backend-free repo documentation
- a simple static code inspection is sufficient

Why it fits this repo:

- this frontend has many interactive flows where code inspection alone is not enough
- it is especially useful for routing, layout, and authenticated UI smoke checks

### `imagegen`

Use when:

- the task requires generating or editing raster visuals
- mockups, bitmap assets, or visual variations are explicitly requested

Do not use when:

- the task is standard app UI implementation in React/SCSS
- the change should be made directly in code, SVG, or existing assets

### `openai-docs`

Use when:

- the repo work involves OpenAI APIs or OpenAI product integration
- up-to-date official OpenAI documentation is needed

Do not use when:

- the task is unrelated to OpenAI products
- the question is already answered by local repo code

Current relevance:

- not part of the default ORISO frontend workflow
- only use when a feature actually touches OpenAI integration work

### `skill-installer`

Use when:

- the team explicitly wants to install an additional skill into the local Codex environment

Do not use when:

- implementing product features
- planning or documenting repo code changes

### `documents:documents`, `presentations:Presentations`, `spreadsheets:Spreadsheets`

Use when:

- the deliverable is a `.docx`, `.pptx`, or spreadsheet artifact

Do not use when:

- changing application code or frontend behavior

Current relevance:

- useful for supporting deliverables
- not part of day-to-day frontend implementation inside `src/`

## Not Approved As Current Repo Skills

The following should not be treated as currently approved implementation skills unless they are actually installed and available in this environment:

- generic external skill catalogs from GitHub
- speculative "frontend-design" or code-review skills that are not installed here
- workflows that require tools not present in this repo or Codex session

For design-heavy frontend work in this repo, rely on:

- `docs/rules/engineering-rules.md`
- the existing component and styling system
- `browser-use:browser` for visual verification

## Repo-Specific Frontend Workflow Guidance

- Start from the existing feature area and visual language before inventing new structure.
- Preserve existing patterns unless the change is intentionally a refactor.
- Use Storybook when working on reusable components or presentational polish.
- Use browser-based verification when touching routing, layout, or complex interaction flows.
- Keep transport/integration behavior in APIs and services, even when the UI task feels "frontend-only".
