# 00 — Problem brief: Timeline view clarifications (#1200)

- **Issue:** [#1200](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1200) — "Timeline view: clarify checkmark function, inline chat status, extended filter bar — against ADRs"
- **Branch:** `claude/1200/timeline-view-clarifications` (based on `upstream/dev` @ `ad5c8c21`)
- **Target:** PR → `OpenResilienceInitiative:dev`
- **Annotated spec image:** `docs/evidence/mvp-showstopper/14-timeline-view.png` on branch `evidence/mvp-showstopper-2026-08` (title _"Timeline view"_)
- **Assignees:** Shirloin, Storypapst, nikunjdecyb

## Jobs transcribed from the annotated image (binding)

| Mark     | Verbatim instruction                                                            | Arrow target                                                                                |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **JOB1** | "Find out what functionality is behind this checkmark according to the ADRs"    | the round double-check button at the end of the filter row (tooltip **"Mark all as read"**) |
| **JOB2** | "Find out what functionality status that you see the chat here directly inside" | the right detail pane (empty state: _"Select a notification to see the details."_)          |
| **JOB3** | "Find out what functionality where is the extended filterbutton bar"            | the filter row, which only shows the chips **Requests** and **Unread**                      |

Screen state in the report: consultant Timeline (Zeitstrahl) tab, search field "Search activity...", list empty ("No activity matches your filters." / "End of activity history").

## Problem

Three functionality questions on the timeline view have no authoritative answer. The archaeology comment (Storypapst, 2026-08-26) frames them as analysis jobs: start from the ADRs and the notification-center/timeline analysis of 2026-08-01, verify before relabeling anything.

## Goal

Authoritative, ADR-referenced answers to the three questions posted on the issue, and the UI corrected where its behaviour or labels diverge from the documented decision.

## Acceptance criteria (from the issue)

- [ ] AC1 All three questions answered with ADR references in a findings comment on #1200
- [ ] AC2 UI corrected where behaviour diverged from the documented decision (only what falls out of the answers)

## Reviewer test plan (from the issue)

- [ ] Press the checkmark with unread activity → behaviour matches the documented function
- [ ] Open a notification's detail → the shown status matches the documented meaning
- [ ] Filters visible match the documented set

## Constraints / non-goals

- Analysis first; no relabeling or removal without an ADR (or explicit product decision) to cite.
- MUI + M3 wrappers, `--m3-*` tokens; preserve Matrix/chat privacy boundaries.
- No new timeline features beyond restoring/removing what the ADRs prescribe.

## Affected area (best guess, confirmed by spike)

Consultant timeline / activity view: filter chip row, mark-all-as-read action, detail pane with embedded chat; ADRs in `ORISO-Docs/oriso-platform/decisions/` (004, 012, 017, 018 mention timeline/notifications).

## Open questions

1. Where is the "notification-center/timeline analysis from 2026-08-01"? Not found in ORISO-Frontend `docs/`, ORISO-Docs, or the client workspace docs — ask the reporter.
2. Which ADR (if any) defines the filter set? If none, the answer to JOB3 is "no decision exists" plus a recommendation, not a code change.
