---
name: pr-prep
description: Package a finished task into a PR-ready summary with test evidence, screenshots, and risk notes. Use after regression-check passes, or when the user asks to prepare or open a PR.
---

# PR Prep

Create `06-pr-summary.md` in the current task folder, then STOP for user confirmation before opening or updating any PR.

Contents:

- **Summary**: what changed and why, 2–4 sentences
- **Files changed**: from `git diff --stat origin/pre-dev...HEAD`
- **Test evidence**: link to `04-test-evidence.md`, plus the headline results inline
- **Screenshots**: embed if UI changed
- **Risks / follow-ups**: anything reviewers should watch, deferred work
- **Security**: link `05-security-review.md` if one was produced

PR conventions for this repo:

- Base branch is `pre-dev`; compare against `origin/pre-dev`.
- Branch name: `cursor/<ticket-or-feature>/<short-slug>`.
- Only commit when the user asks; never push or open the PR without explicit confirmation.
