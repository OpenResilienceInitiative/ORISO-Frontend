# 00 — Problem brief: live session-list updates (#1206)

- **Issue:** [#1206](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1206) — "Session lists need a hard refresh to show new users and chats — live updates missing"
- **Branch:** `claude/1206/live-session-list-updates` (from `upstream/dev` @ `501959f3`)
- **Target:** PR → `OpenResilienceInitiative:dev`
- **Image:** `screenshots/issue-annotated-report.png` (dev.oriso.org, counsellor "Anfragen" tab)
- **Assignees:** Shirloin, Storypapst, nikunjdecyb

## Job transcribed from the annotated image (binding)

| Mark                   | Verbatim                                                                                                                                                        | Target                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **JOB1** — prio medium | "make sure that clients and counsellors page refreshes (eg. moving from request towas chats) — the hard reload for the upadte is not a feasible option. /debug" | the counsellor's request list (Anfragen), which only gains new entries after a hard reload |

Headline (yellow): _"PRIO URGENT: I must hard refresh to see new user atm"_.

Also visible in the capture and **explicitly out of scope**: the raw preview tokens `[[align:left]]<p>halooohoho</p>[[/align]]` — that is the raw-preview family of #1191 / #1117; the issue says "do not fix it here".

## Problem

A counsellor must hard-refresh the browser to see a new user/enquiry; the request→chat transition does not appear live for either party.

## Goal

New items and the request→chat transition reach both roles' lists without any reload.

## Acceptance criteria (from the issue)

- [ ] AC1 New users/enquiries appear in the counsellor's lists without any reload
- [ ] AC2 Request→chat transition updates live for both parties
- [ ] AC3 An E2E regression test exists
- [ ] AC4 `test:unit`, `lint:scripts`, `build` pass

## Constraints from the archaeology comment (2026-08-26)

- Same defect family as **#1199** (asker-side enquiry→conversation): one root-cause investigation for both; no existing fix on any branch.
- The nearest shipped work, **#851** (merged), reworked exactly this producer path — `request.new` is bypassed when the Matrix room is pre-created — which makes the subscription/producer wiring the prime suspect.
- The raw-preview tokens are #1191's; coordinate, do not duplicate.

## Reviewer test plan (from the issue)

- [ ] Two browsers: asker sends first enquiry → counsellor's request list gains the entry without reload
- [ ] Counsellor accepts → both sides move to the chat view without reload
- [ ] Counsellor idle 10 minutes, then repeat → still updates (no dead subscription)

## Method

`superpowers:systematic-debugging` — Phase 1 (root cause) before any fix; then TDD per `superpowers:test-driven-development`.
