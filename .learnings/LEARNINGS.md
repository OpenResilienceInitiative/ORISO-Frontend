# Learnings

Reusable lessons from completed tasks. One concept per entry, newest first, keep each under 5 lines. Promote to AGENTS.md only if it applies to most future tasks.

Format:

```markdown
## YYYY-MM-DD <short title>

- Context: <task folder or area>
- Lesson: <what to do differently next time>
```
# 2026-07-08 — matrix-js-sdk production logging

`matrix-js-sdk` defaults child loggers to `DEBUG`, so `FetchHttpApi` sync lines appear even when app `console.log` calls are removed. Call `logger.setLevel('error')` at startup and patch `getChild` so child namespaces inherit the same level; pass `logger` into every `createClient` call.
## 2026-07-10 — JS-driven widget size vs CSS min-height

When a call (or other) widget sets `width`/`height` via inline styles for resize/auto-fit, a stylesheet `min-height` on the same element can silently win and break aspect ratio. Prefer `min-height: 0` (or matching the JS min) when size is state-driven.

## 2026-07-11 — CallManager.endCall reentrancy

`matrixCall.hangup()` can synchronously emit `state: ended`, which calls `endCall()` again. Clearing `currentCall` only at the end lets the outer frame read `null.matrixCall`. Snapshot the call, set `currentCall = null` first, then hang up / tear down using the snapshot.
