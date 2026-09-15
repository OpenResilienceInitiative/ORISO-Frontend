# 00 — Problem brief: Absence (vacation responder) UI (#1210)

- **Issue:** [#1210](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1210) — "Vacation responder: wrong dialog after sign-out, unclear client view, absence correlates with broken session encryption"
- **Branch:** `claude/1210/absence-banner-ui` (based on `upstream/dev` @ `85c6d208`)
- **Target:** PR → `OpenResilienceInitiative:dev`
- **Images:** `screenshots/issue-annotated-report.png` (report, 3 panels), `screenshots/before-current-dev-banner.png` (shazia-k, 2026-09-05, state after PR #1313)
- **Assignees:** Shirloin, Storypapst, nikunjdecyb (shazia-k commented "I am working on this issue" on 2026-09-04 and shipped #1313)

## State when picked up (2026-09-06)

- Archaeology (Storypapst, 2026-08-27): absence is frozen legacy code, touches no Matrix code; the encryption correlation is the missing silent key-backup fix (PR #1033, ships via dev sync #1178) → **not an absence bug**; version dig done.
- PR #1313 (merged 2026-09-05): the asker's absence notice was rendering behind the composer card → now visible. shazia-k: "its design needs to be refactored" (screenshot: bare full-width grey strip, ⓘ + "shaziaknew ist abwesend" + message text, no card, no M3 tokens).
- Report DEBUG 2 / issue job 2: "Willkommen zurück!" deactivation dialog appears after signing out of a _user_ session → suspected stale user-data context during logout (AbsenceHandler mount effect).
- Job 4 (what the client should see) is a product decision (Christine) — current behaviour: banner + composer stays writable.

## Jobs transcribed from the annotated image (binding)

| Mark    | Verbatim                                                                                           | Target                                                                |
| ------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| DEBUG 1 | "analyse expected behaviour and in what version the last commits where"                            | counsellor profile → Meine Abwesenheit (done by archaeology)          |
| DEBUG 2 | "Analyse after i sign out from the user session i get this vacation responder message."            | "Willkommen zurück!" dialog (Ja/Nein)                                 |
| DEBUG 3 | "While the counsellor übunxxxxx was while at absense the encryption of current session was broken" | DecryptionError bubbles in the asker chat (explained: key-backup gap) |
| JOB2    | "tbd / Christine disco what should the client actually see"                                        | asker chat + composer                                                 |

## Problem (this PR's scope)

1. The asker-side absence notice is visible but unstyled: full-width grey strip outside the M3 language (no surface container / radius / spacing / typography tokens).
2. The counsellor-only deactivation dialog can appear in the wrong context after a user-session sign-out (root cause to be confirmed in the spike).

## Goal

Asker sees a properly designed absence notice consistent with the app's other in-conversation info cards; the deactivation dialog only appears for a counsellor signing into the counsellor app.

## Acceptance criteria

- [ ] AC1 Absence notice uses M3 tokens/shape consistent with existing info cards; readable at desktop + mobile; still above the composer, composer stays writable (current product behaviour)
- [ ] AC2 Deactivation dialog appears only in the counsellor context (unit test for the gate)
- [ ] AC3 `test:unit`, `lint:scripts`, `lint:style`, `build` pass; Storybook story for the notice
- [ ] Not in scope: encryption (tracked via #1033/#1178), client-view product decision (job 4) beyond keeping current behaviour

## Open questions (non-blocking)

1. Exact target visual: no Figma link on the issue → follow the existing M3 info card (encryption notice) pattern; confirm with reviewers via screenshots.
