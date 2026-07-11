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
