---
name: problem-intake
description: Normalize problem statements from tickets, GitHub issues, raw docs, chat text, or MCP sources into a minimal implementation brief with acceptance criteria. Use at the start of any task, or when the user pastes a ticket, requirement doc, or bug report.
---

# Problem Intake

Create `docs/agent-tasks/YYYY-MM-DD_short-feature-name/00-problem-brief.md`.

Include only:

- **Source**: links or "chat" — never copy long source text, summarize it
- **Problem**: the exact reported problem, 1–3 sentences
- **Goal**: business outcome in one line
- **Acceptance criteria**: checkbox list; each must be verifiable by a test, lint, build, or observable UI behavior — these are the goal-loop exit test
- **Constraints / non-goals**
- **Affected area**: modules or paths, best guess is fine
- **Open questions**: only questions that block implementation

Rules:

- Keep the whole brief under ~300 words.
- If requirements are sufficient, do not ask redundant questions; proceed.
- If a question is genuinely blocking, ask it before planning, not mid-loop.
- Everything else (findings, options, risks) belongs in `01-spike.md`, not here.
