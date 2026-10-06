# ADR-020: The practice area is a frontend-only simulation

- Status: Proposed
- Date: 2026-10-06
- Owners: ORISO Frontend
- Decision scope: ORISO-Frontend (epic [#1622]); no backend change except one configuration list in ORISO-UserService
- Spike result: `src/practice/SPIKE-REPORT.md`

## Context

The product tours explain screens, but a counsellor cannot practise the real
workflows: an enquiry only exists after an advice seeker has written one, and
nobody may click through real cases for a tutorial. We want a **practice area**
(Übungsbereich): the real UI, driven by fixed fictional people, where a
counsellor accepts an enquiry, uses the Team-Besprechung and adds a supervisor
without any real person, case, e-mail or statistic being touched.

Three ways to get fictional cases into the real UI were researched on
`origin/dev` on 2026-10-06:

- **A. Marker or filter inside the counsellor's real agency.** A Hibernate
  filter would cover about 12 list queries but not about 48 other sites
  (17 native SQL statements, 22 `findById` calls, statistics events, the Matrix
  room itself). Dummy consultants with a `consultant_agency` row are also
  fanned into every real enquiry room.
- **B. A hidden practice agency per Träger with real rows.** Needs a new
  idempotent AgencyService endpoint, practice flags on agency, session,
  consultant and asker, about 23 native statistics statements, notification and
  listener guards, licence-count exclusion, a janitor and the AVV gate per
  Träger. It also opens a hole: registration only checks that an `agencyId`
  exists, so a forged id could register a real advice seeker into the practice
  agency.
- **D. A frontend-only simulation.** The real UI components run on hard-coded
  in-memory fixtures. Nothing is written to a server and nothing is stored.

## Decision

Take **D**. The practice area is a simulation inside the counsellor's own
browser tab:

- A fake REST backend (typed against the generated DTOs) is layered over
  `window.fetch`; a fake Matrix service with real `MatrixEvent`s is provided
  through the Matrix context and the registry.
- **Safety claim 1:** no mutating request leaves the page in practice mode. A
  default-deny `NetworkGuard` wraps `fetch`, `XMLHttpRequest` and `sendBeacon`
  from entering to leaving practice. The allowlist is exactly the tutorial
  progress `PUT` of the running tour and the identity-provider token refresh.
- **Safety claim 2:** practice state lives in memory only. No `localStorage`,
  `sessionStorage` or IndexedDB write; practice ids are negative numbers and
  room ids carry a non-routable prefix, so they can never be real ids.
- The script (cast, texts, reactions) is fixed, deterministic and shipped in the
  i18n resources; there is no AI and no backend practice data.
- Flows start only by a deliberate click, are desktop only in v1, and sit behind
  a release toggle (`releaseToggles.enablePracticeArea`, default off) plus the
  existing platform master switch `enableWalkthrough`.

The decision was gated by a spike. Verdict (S0, 2026-10-06): the real
`SessionsList`, `SessionStream`, `SessionItemComponent`, `AcceptAssign` and
supervisor flow run unmodified on the fixtures with the real Matrix client
still registered in the page; see `src/practice/SPIKE-REPORT.md`.

## Consequences

- No backend practice data exists, so there is nothing to delete, nothing to
  leak into statistics, e-mail or notifications, and no migration. The one
  backend touch is configuration: both tour ids must be on the UserService
  allowlist `tutorial.tours.frontend`.
- Fidelity is "real components on fake data". When a backend contract changes,
  the fake can drift; the fake REST responses are typed against the generated
  DTOs and a test fails on type drift.
- The guard is a JavaScript guard. It cannot cover form or link navigations, a
  `fetch` reference taken before installation, a replaced `window.fetch`, other
  windows, or WebSocket frames. The Playwright proof (T2) asserts the claim from
  the outside, and the app does not contain such code today.
- A few real components carry small, tested practice guards (composer upload and
  voice, session menu calls, storage keys for negative ids, supervisor
  side-room refresh). They are no-ops outside practice mode.
- Option B stays rejected. It is only reconsidered after a new decision, for
  example if a flow needs real Matrix rooms (calls, attachments, end-to-end
  encrypted history).

## Alternatives considered

A and B above. Also considered and rejected: a purely Storybook-style
recomposition (kept only as the fallback had the spike failed) and an isolated
window or iframe (not needed after the spike).

[#1622]: https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1622
