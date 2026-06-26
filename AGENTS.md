# AGENTS.md

## Context First

- Treat `dev` as the normal integration branch for ORISO feature PRs unless the task says otherwise.
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
- If a full command is too expensive or blocked by existing unrelated failures, run the narrowest relevant command and state the blocker precisely.

## Review Expectations

- Cursor should compare PRs against `origin/dev` for normal ORISO feature work.
- CodeRabbit is optional/manual and should not be treated as the primary automated reviewer.
- Automated review should flag missing tests, duplicated UI architecture, unsafe privacy changes, and mergeability risks.
- Only auto-fix issues that are clearly scoped and testable. Leave architectural or ambiguous changes as review comments.
