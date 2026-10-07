# Practice area (Übungsbereich)

## Summary

- Counsellors practise two real workflows (accept an enquiry with a
  Team-Besprechung, add a supervisor) on fixed fictional people.
- Success: the real UI runs on in-memory fixtures; practice data stays in memory.
  Only the allowed tutorial-progress update and identity refresh leave the page. Epic #1622, decision record ADR-020.

## Original Problem

- Product tours explain screens but cannot practise workflows: an enquiry only
  exists once an advice seeker writes one.
- A backend practice agency (option B in ADR-020) would touch statistics,
  notifications, licences and registration; it was rejected.

## Implemented Changes

- `src/practice/`: default-deny network guard, fake REST backend typed against
  the generated DTOs, fake Matrix service, scripted cast, two guided tours,
  banner, practice cards in Profile, Help.
- Small practice guards in real components (composer media, session menu
  calls, storage keys, history-key requests), all no-ops outside practice.
- Release toggle `releaseToggles.enablePracticeArea`, default off.

## Testing

- Unit tests for guard, ids, fake backend, script, tours and banner placement.
- jsdom integration runs of both flows on the real containers; the Chromium
  story `Organisms/PracticeFlow`.
- Playwright smoke against Dev (`practice-network-guard.smoke.spec.ts`):
  runnable, not run yet.

## Risks / Assumptions

- The fake can drift from backend contracts; the type check catches DTO drift.
- A JavaScript guard cannot cover form or link navigations or WebSocket frames.
- Open product decisions: live-chat heartbeat, incoming calls, notification
  burst after the exit, join-request snackbars (see `src/practice/README.md`).

## Review delivery — 6 October 2026

Both [Frontend PR1624](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1624)
and [UserService PR1349](https://github.com/OpenResilienceInitiative/ORISO-UserService/pull/1349)
are open for review. [Issue1622](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1622)
is In review, planned for v2.0.11. Reviewers are requested. Opening the PRs is
separate from passing CI, human review, merge and deployed Dev acceptance.

The source review corrections cover immediate auth expiry restoring the real
Matrix service, unsent practice drafts draining without reaching the real API,
required tour controls interrupting rather than falsely completing, and the
practice banner remaining accessible while the supervisor picker is open.
Acceptance starts at the real desktop layout; supervision starts only when its
actual supervisor control is available. Resizing cannot restart a practice
without another deliberate Start. Browser stories cover both acceptance
variants and supervision with the real containers.

The assembled feature includes the latest dev changes. Final validation results
and current CI are recorded in the PR description. The release flag remains off
until deployed proof and the retained product decisions are settled.

Help now groups the automatic-start preference, the short introduction and the
two gated hands-on practice flows in one Meine Rundgänge card. The user approved
replacing the displayed Mail-Beratung offer with these exercises. Its tour
definition, launch compatibility and saved progress remain available; the
practice release flag stays off by default.
