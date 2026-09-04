# Cursor agent README (this repo)

How to run tickets in Cursor. Superpowers is **optional**: use it when installed; otherwise use the skills under `.cursor/skills/`. PRs target **`dev`**. Never commit on `dev`.

## Commands (slash / attach)

In Cursor chat you can type `/` and pick a skill, or `@` a file/folder.

| You type or attach       | When                                                        |
| ------------------------ | ----------------------------------------------------------- |
| Paste a GitHub issue URL | Start from a real ticket                                    |
| `/goal-loop`             | Iterate until acceptance criteria pass                      |
| `/using-superpowers`     | Prefer Superpowers method (only if the plugin is installed) |
| `@AGENTS.md`             | Force the agent to use this repo’s test commands            |
| `@.cursor/README.md`     | Re-read these prompts                                       |

Branch: `cursor/<issue-number>/<short-slug>` from `origin/dev`. Link the issue in the PR (`Refs #<n>` or `Closes #<n>`).

## Always name the issue

Start every prompt with the issue URL or `OpenResilienceInitiative/<this-repo>#<n>`. One parent issue per effort. If the change spans repos, still use that issue as the anchor and comment each PR on it.

## Demo — small feature or bug (one repo)

```text
Issue: https://github.com/OpenResilienceInitiative/<this-repo>/issues/<n>

Small change. Branch from origin/dev. Do not commit on dev.

Problem: <one sentence what is wrong today>
Expected: <one sentence what the user should see>
Out of scope: <anything we are not doing>

Use Superpowers if installed; otherwise problem-intake → failing test → fix → verify.
Run the repo checks from AGENTS.md. Open a PR against dev. Then update the GitHub issue
with proof (commands + screenshot or log snippet + PR link).
```

## Demo — large feature (plan first, then implement)

```text
Issue: https://github.com/OpenResilienceInitiative/<this-repo>/issues/<n>

Large feature. Do not skip planning.

1. Summarize the issue: current vs expected user-visible behavior, acceptance criteria.
2. If anything is unclear about users, data, permissions, or APIs, ask before coding.
3. If Superpowers is installed: brainstorming then writing-plans. If not: spike-doc then
   task-implementation-doc under docs/agent-tasks/YYYY-MM-DD_short-name/.
4. Implement with TDD (RED → GREEN → REFACTOR). One behavior at a time.
5. Verify with AGENTS.md commands. PR against origin/dev. Do not merge.
6. Update the GitHub issue with the proof template below and attach screenshots.
```

## After the feature — update the issue (required)

Post a comment on the **parent GitHub issue** (not only in Slack/chat). Attach screenshots or log files in that comment. Include actual commands, not “tests passed”.

```markdown
### Status

Done for this repo / blocked / in review — PR: <url>

### What changed

<2–4 bullets, user language>

### User-visible behavior

Before: …
After: …

### Proof

- Command: `<exact command>` → pass (counts or one-line result)
- Screenshot / recording: <attached>
- PR: <url> (base `dev`)

### Risks / follow-up

<none, or what is still open>
```

Also comment the PR link on the issue when you open the PR (`Frontend part: <url>`).
