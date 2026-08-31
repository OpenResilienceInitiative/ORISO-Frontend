# Learnings

Reusable lessons from completed tasks. One concept per entry, newest first, keep each under 5 lines. Promote to AGENTS.md only if it applies to most future tasks.

Format:

```markdown
## YYYY-MM-DD <short title>

- Context: <task folder or area>
- Lesson: <what to do differently next time>
```

## 2026-08-31 — positional t() second args hide leftover English

- Context: `docs/agent-tasks/2026-08-30_issue-1154-i18n-consistency/` (#1154 audit)
- Lesson: After dropping `t(key, 'literal')`, still search for `t(key, variable)` whose variable holds DE/EN (preset labels, `phase.charAt(0)…`). A SLICE_FILES scan that only matches quoted literals will call the platform clean while those fallbacks still snap the UI.

## 2026-08-02 — PR screenshots need a non-ignored docs path

- Context: #834 Threads list plain preview (`docs/agent-tasks/` is covered by `docs/*` ignore)
- Lesson: Put PR-attached screenshots under an allowed path such as `docs/storybook/…` (or add a gitignore negation for the task folder) so raw GitHub image URLs work in the PR body.

## 2026-08-02 — Element Call warm-up must release parent MediaStream

- Context: `docs/cursor-orchestrator/2026-08-02_camera-activation-bug/` (gitignored under `docs/*`)
- Lesson: If SessionMenu/`getUserMedia` warms permissions for Element Call, stop tracks immediately. Do not leave `__preRequestedMediaStream` for FloatingCallWidget when `usesElementCall` is always true — that orphans live tracks and breaks re-join after leave/refresh.

## 2026-07-28 — cutover guards must scan auxiliary frontend surfaces

- Context: `docs/cursor-orchestrator/2026-07-28_remove-storybook-rocketchat/`
- Lesson: Provider-removal contracts must include Storybook, fixtures, and tracked backup files; production-source scans alone can leave retired runtime assumptions behind.

## 2026-07-14 — orchestration docs must match git-workflow base

- Context: `docs/cursor-orchestrator/2026-07-14_pr-385-review-cursor-docs/` (PR #385 review)
- Lesson: Keep `goal-loop`, `pr-prep`, `AGENTS.md`, and `git-workflow.mdc` on the same base (`pre-dev`). If orchestration writes under `docs/cursor-orchestrator/`, add a `.gitignore` negation or the trail cannot be committed.

## 2026-07-14 — Storybook Vite + MUI `styled_default`

Blank Storybook canvas with `styled_default is not a function` is a Vite prebundle race around `@emotion/styled` / `@mui/material`. Fix: early `import '@mui/material/styles/styled'` in `.storybook/preview.tsx`, `optimizeDeps.include` for emotion/MUI in `.storybook/main.ts`, and clear `node_modules/.cache/storybook` after changing those.

## 2026-07-10 — JS-driven widget size vs CSS min-height

When a call (or other) widget sets `width`/`height` via inline styles for resize/auto-fit, a stylesheet `min-height` on the same element can silently win and break aspect ratio. Prefer `min-height: 0` (or matching the JS min) when size is state-driven.

## 2026-07-11 — CallManager.endCall reentrancy

`matrixCall.hangup()` can synchronously emit `state: ended`, which calls `endCall()` again. Clearing `currentCall` only at the end lets the outer frame read `null.matrixCall`. Snapshot the call, set `currentCall = null` first, then hang up / tear down using the snapshot.

## 2026-07-12 — TipTap empty composer vs HTML trim

TipTap empty docs are markup like `<p></p>`. Using `!composerText.trim()` for “empty” blocks edit-last and similar guards. Prefer plain-text extraction (`textContent` / shared strip helpers).

## 2026-07-12 — Browser shortcut conflicts need capture phase

App handlers for Cmd/Ctrl+F, Cmd/Ctrl+Shift+N, Cmd/Ctrl+K must listen in the capture phase and `preventDefault()` before the browser’s default Find / New Window / etc. Bubble-phase listeners are too late. Also set `activeInTextInput: true` when the action must work with the composer focused.

## 2026-07-08 — matrix-js-sdk production logging

`matrix-js-sdk` defaults child loggers to `DEBUG`, so `FetchHttpApi` sync lines appear even when app `console.log` calls are removed. Call `logger.setLevel('error')` at startup and patch `getChild` so child namespaces inherit the same level; pass `logger` into every `createClient` call.
