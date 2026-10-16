# Issue tracker

Code repository: `OpenResilienceInitiative/ORISO-Frontend`.
Tracker: [GitHub Issues](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues) in `OpenResilienceInitiative/ORISO-Frontend`.
Use an explicit repository argument; resolve cross-repository concerns through the project rules before publishing.

For agents — read or publish a ticket in the configured repository:

```bash
gh issue view <number> --repo OpenResilienceInitiative/ORISO-Frontend --comments
gh issue list --repo OpenResilienceInitiative/ORISO-Frontend --state open
gh issue create --repo OpenResilienceInitiative/ORISO-Frontend --title '<title>' --body-file <body-file>
```

## Project workflow

Resolve machine-local paths through `~/.config/agent-routing/paths.env` before reading `${PROJECT_ORISO_ROOT}/AGENTS.md`.
For issue/PR work, follow `${PROJECT_ORISO_ROOT}/0 - Docs/issue-task-workflow.md` and the portable `issue-subtask-pr-loop` skill resolved by the project/global router. These sources own classification, board fields, ownership, review, and delivery gates; this adapter does not replace them.
Read `triage-labels.md` before applying a label. Ticket publication requires authorization from the current task; setup alone grants none.

**PRs as a request surface: no.**

## Skill vocabulary

"Publish to the issue tracker" means create a ticket in the configured tracker after the workflow and authorization checks above. "Fetch the relevant ticket" means read its full body, labels, and relevant comments in that tracker. Preserve a supplied explicit ticket URL when it points to another owning repository.
For parent/child tickets and blocking edges, use the project's native relationships and workflow; do not invent a second label scheme or board. No wayfinder labels have been provisioned by this setup.

## Wayfinding operations

The map is an issue in the owning repository; decision tickets use GitHub's native parent/sub-issue relation. Use native blocking dependencies, not labels or checklist links, for blocking edges. The frontier is the map's open, unassigned children whose blocking issues are all closed; inspect native children and dependencies rather than treating every open ticket as available.

The `wayfinder:map` and `wayfinder:<type>` labels are not provisioned by this setup. Before publishing a wayfinder map or decision ticket, resolve the label mapping through the project workflow and obtain any required authorization. If that mapping is absent, keep the proposal as a draft and report the missing capability. Do not invent labels, a local replacement tracker, or parallel board states.

For agents — GitHub operations after the project classification and publication gates pass:

```text
Create the map and decision issues through issue-subtask-pr-loop with the required owner, type, release and project fields. Link each decision using GitHub native sub-issues; a body link alone is not the relationship.
List native children: GET repos/<owner>/<repo>/issues/<map-number>/sub_issues (paginate).
Read a child's native blockers: GET repos/<owner>/<repo>/issues/<child-number>/dependencies/blocked_by (paginate); check each blocker's current state.
Add blocking edge: POST repos/<owner>/<repo>/issues/<child-number>/dependencies/blocked_by with issue_id=<blocker numeric database id>, not its issue number or node_id.
Frontier: open native children in map order, with no assignee and no open blocker.
Claim first: gh issue edit <child-number> --repo <owner>/<repo> --add-assignee <driving-human-login>; read back the assignee before work.
Resolve: record the decision outcome on the child; close only when the project's human/closure gates permit it. Then append a gist and child link to the map's Decisions-so-far section, preserving the rest of its live body.
```

If native relationships or dependency access are unavailable, report the missing capability before publishing; do not silently replace them with checklist links or another tracker.
