# Practice area (Übungsbereich), safety core

Frontend-only simulation, spec `0 - Docs/SPEC-practice-area-guided-flows-2026-10-06.md`
sections 4 and 5. Two claims must stay provable:

1. **No mutating request leaves the page in practice mode.** `NetworkGuard`
   wraps `fetch`, `XMLHttpRequest` and `navigator.sendBeacon`. GET, HEAD and
   OPTIONS pass; every other request is blocked (fetch rejects with
   `PracticeBlockedRequestError`, XHR errors out, beacon returns `false`) and
   counted by method and URL, never query or body. Proof: the guard's unit
   tests (`networkGuard.test.ts`) and the runs of the flows that record every
   request: the jsdom integration tests (`PracticeSandbox.integration.test.tsx`,
   `PracticeFlow.integration.test.tsx`) and the Chromium story
   `Organisms/PracticeFlow`. The Playwright run against Dev
   (`playwright/practice-network-guard.smoke.spec.ts`, built on
   `assertNoPracticeWrites`) is runnable but has not been run yet.
2. **Practice state lives in memory only.** No localStorage, sessionStorage or
   IndexedDB (`PracticeProvider.test.tsx`). Practice ids are negative,
   `practice-...` or `...:practice.invalid`, so never a real id (`practiceIds.ts`).

## Allowlist (exact, fetch only)

- `PUT` to `endpoints.tutorialProgress` (no query), JSON body with
  `surface: "frontend"` and the `tourId` of the running practice tour.
- `POST` to `endpoints.keycloakAccessToken` with `grant_type=refresh_token`,
  `client_id=app` and no credentials. The password grant shares the URL: blocked.
- `POST` to `endpoints.consultantLiveChatAvailabilityHeartbeat` (no query) with
  an empty body: the real live-chat heartbeat. It only renews a lease the
  counsellor already holds for real; switching availability on or off (`PUT`)
  stays blocked. Decided by Frank on 2026-11-25 (FE#2545), so a counsellor who
  is really available stays in the real queue while practising.
- Unparseable, unreadable or oversized bodies fail closed. XHR and beacons get no
  exception. SigNoz/OTLP exports are blocked (non-essential). WebSocket is not
  wrapped (the app only receives on it), and no test that has run asserts on
  its frames.

## Adding an endpoint to the allowlist

You must not. The list is the spec (section 4); a new entry needs a spec change
decided by Frank, plus tests in `networkGuard.test.ts` and
`assertNoPracticeWrites.test.ts`. Practice endpoints are answered by the fake
backend and never reach the network.

## Lifecycle and layering

`enterPracticeMode` installs the guard BEFORE it reports active. Layers on top
(fake backend, Matrix rebinding) register `onPracticeExit(teardown)`;
`exitPracticeMode` runs them newest first, then removes the guard. A JS guard
cannot cover form or link navigations, a pre-install `fetch`, or a replaced
`window.fetch`.

**One exit path: `endPractice()`.** Banner End, the tour's end hook, logout and
the provider's unmount all call it; restart is a new run on the running guard.

1. It publishes `closing`. `PracticeSurface` renders nothing, so the sandbox and
   the practice views unmount while the guard is still on; `usePracticeActive`
   still says "practising".
2. One macrotask later it waits for every exit hold (`holdPracticeExit`), at most
   `PRACTICE_DRAIN_TIMEOUT_MS`. The sandbox holds until its last fake request
   was answered and it uninstalled; the surface holds until the router has
   landed back where practice started (navigations are transitions).
3. Then `exitPracticeMode()`: teardowns newest first, guard off.

It is idempotent (a second call returns the same promise). An `enterPracticeMode`
while closing cancels the exit through an epoch token and keeps the guard.
`exitPracticeMode()` stays the immediate exit, for `teardownLocalSession` and
for logout after the drained end (the Keycloak logout is a POST).

**Emergency auth teardown.** The sandbox restores the retained real Matrix
service synchronously on `exitPracticeMode`, so `teardownLocalSession` stops
that service before login can render. The fake REST layer stays until its
pending requests and practice-addressed unmount writes drain; the forgotten
real service is never restored by a later sandbox cleanup. Proof:
`practiceLogout.integration.test.tsx` uses the actual sandbox, registry and
Matrix service, with a pending streamed practice PATCH during teardown.
Unsent composer cleanup stays in memory too: composite practice room/thread
scopes and the shared draft index remain isolated while the fake REST layer
drains. Real draft scopes and list reads from the restored page pass through.

**Required actions.** Every practice tour uses `requiredTargetPolicy: 'stop'`.
A missing required control interrupts the run without a terminal progress
write; it cannot fall through to the explanations and record completion.
Regular tours keep their existing missing-target skip policy. Proof:
`ProductTourAdapter.component.test.tsx` records the progress HTTP boundary for
the Supervision tour with absent controls, and `tourEngine.test.ts` covers a disappearing target.

**Window size.** The Einführung starts as practice in the real accept
controls' `fromL` layout (900 px, F1's range); the Supervision tour needs
`fromXL`, where the real supervisor plus is interactive. Below its range the
Einführung's card still starts and runs the watch-only Einführung; the
Supervision card shows the window hint (phone: phone hint) and cannot start
(there is no explanation tour). Resizing a practice run below its range ends
it, so widening the window requires another deliberate Start.
Proof: `HelpToursSection.test.tsx` checks both cards at 1199, 1200 and 390;
`PracticeFlow.integration.test.tsx` checks the Einführung at 1199 (practice),
899 and 390 (watch-only) and the Supervision boundary at 1199/1200.

**Restart.** The banner asks the tour host for a new run of the same tour. The
host ends and re-enters on the running guard; the re-enter runs the restart
handlers, and `PracticeSandboxSlot` registered the sandbox's `restart` there:
fresh fixtures, tour from step 1, same guard.

**Routes.** While practising, a real case route leads to the practice enquiries;
outside practice, a practice case route does (Back after End). A request that
carries a practice id in its path or query never reaches the network: the
fake answers it; if the fake does not know the id, a read gets an empty 204 and
a write fails like any blocked write (a 404 would send `fetchData` to the error
page).

## What stays real

The sandbox wraps the routed content only (`<Outlet/>` in `Routing.tsx`): the
case views get the fake Matrix service, the practice sessions store, topics and
notifications. Its `fetch` patch is page-wide, so the shell's requests for
practice endpoints are answered from memory too. The shell around it stays on
the real contexts. Proof: `PracticeFlow.integration.test.tsx` walks the Einführung (both
variants) and the topic tours through the real navigation bar, header, banner and tour host.

**Permanent controls.** The banner uses a page-level portal and the theme's
tooltip layer, above the supervisor dialog's modal layer. The picker and banner
share a focus trap, so End remains accessible by pointer, keyboard and screen
reader while the picker is open. The dropdown stays inside the dialog's
container, so its modal manager does not hide the banner. Proof:
`PracticeFlow.integration.test.tsx` and local Chromium picker captures.

Known limits: while practising, `/service/error-reports` is answered
by the fake, so an error report from a practice run is not sent. The real reads
in the table below were reviewed by hand; no test pins them.

| Outside the sandbox                                       | Shows                                                                       | Decision                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Navigation bar links, `/notifications` badge              | labels; an own unread number                                                | accept: no case data; the app-level sessions store is never written                 |
| Zeitstrahl feed (`/notifications`, inside the outlet)     | real rows with asker names and links                                        | neutralised: the sandbox blanks the feed and its actions                            |
| Header title, claim, agency logo                          | tenant; the practice agency while a practice case is open                   | accept                                                                              |
| Header UI version switch                                  | one click opens Element with every real room                                | neutralised: hidden while practising                                                |
| Toast host, sound, OS banner                              | toasts of the practice views; real feed events after the exit, in one burst | accept (generic titles, no names)                                                   |
| JoinRequestCenter snackbars                               | real colleague names and group titles                                       | accept: not case data; admit/decline fail while practising                          |
| Incoming real calls (FloatingCallWidget, GroupCallWidget) | ringing, asker initial                                                      | accept for now: answering fails while practising (decision below)                   |
| Live-chat availability heartbeat                          | nothing until it lapses                                                     | allowlisted (Frank, 2026-11-25): real availability keeps its lease while practising |
| Language switch, mute bell, absence overlay               | own settings                                                                | accept: the server write is blocked while practising                                |

**Live-chat availability in practice (FE#2545).** The live-chat practice tour
asks the counsellor to switch "Bin verfügbar" on with the real control (the
settings switch, or the rail toggle with `liveChatViaSidebar`). While
practising, both controls and the session list read
`usePracticeLiveChatAvailability`: an in-memory value per practice run that
starts off and never calls the API, writes localStorage or feeds the heartbeat.
The heartbeat and the loss/DPA notices keep the real state. Proof:
`practiceLiveChatAvailability.test.tsx` and the two live-chat runs in
`PracticeFlow.integration.test.tsx` (no availability PUT or heartbeat POST, no
`oriso_liveChat*` storage write, real state shown again after the exit).

**Group-call start in practice (FE#2545, D3).** The Gesprächskreis practice
tour creates, opens and starts a circle in the fake backend, then asks the
counsellor to use the real call button. `GroupChatHeader`'s call handler asks
`isPracticeMode()` first and calls `simulatePracticeCallStart` instead: no
`getUserMedia`, no `callManager`, no request. `PracticeCallStartDialog`
(mounted by the sandbox, an `M3Dialog`) says what the real button does and
closes with one button; the tour advances on `practice:circle-call-started`.
Proof: `practiceCallStart.test.tsx`, `GroupChatHeader/practiceCallGuard.test.tsx`
and the two Gesprächskreis runs in `PracticeFlow.integration.test.tsx`.

**Kalender in practice (FE#2545).** The Kalender topic tour runs on the
real "Meine Termine" with the accepted practice case as the counsellor's
one conversation. The counsellor enters an appointment, a second one with
"Weitere Personen per Link einladen" (the Terminlink points at the reserved
host `practice.invalid`), cancels one from "Als Nächstes", enters a
Sperrzeit and switches "Buchungen automatisch bestätigen" on in the
Sprechstunden. The fake backend answers every read of the page (entries,
proposals, colleagues (none), auto-accept, sync, Sprechstunden and one-offs,
working hours, direct links, upcoming appointments) and keeps every write in
memory; the appointment notices go to the practice room. No allowlist entry
was added. Real reads that stay real: the counsellor's own agency settings
(`/service/agencies/<ids>`, they decide "Direkteinladung erlauben" and are
cached page-wide) and static assets. Known limit: the navigation's proposal
count takes the practice calendar's count (0) and keeps it after the exit
until its next load (at most a minute). Proof: the calendar tests in
`FakeRestBackend.test.ts`, the Kalender run in
`PracticeFlow.integration.test.tsx` and the story `Organisms/PracticeFlow ›
Calendar`.

**Einführung in practice (FE#2545).** The counsellor Einführung
(`consultant-walkthrough`) absorbed the card "Übung: Anfrage annehmen"
(F1, `consultant-practice-accept`); there are no practice cards any more
(`PracticeOverviewSection` and `PracticeCards` are gone, and with them the
"Übungsbereich" part of Help). Version 2 (PO: a reworked tour shows as new):
a completion of version 1 does not count, in Help or for the auto-start.
Where practice can run (practice area open, `fromL`), its Help card and the
"?" launcher start `practiceIntroTour`: welcome, the Anfragen list, the
practice enquiry opened and accepted with the real controls, a first reply
(the script answers, as F1 did), the answer, "Meine Beratungen" and "Archiv",
done; 9 steps, F1's practice start, accept and script. Everywhere else the
watch-only Einführung (`consultantWalkthroughTour`, same id and version, one
status in Help) runs on the real page, so the Einführung never disappears
for a new counsellor. The auto-start after login is always the watch-only
Einführung, also on a desktop where practice could run: practice mode never
starts without a deliberate Start (first-login dialogs such as 2FA keep
their writes). Where the practice area is open, the last step of the
watch-only Einführung ends with one sentence pointing to the practice
("Am Computer können Sie das unter Hilfe → Rundgänge auch üben."; key
`walkthrough.step.6.introWithPractice`, swapped in by the host, the step
count stays 5). In practice, the deleted-asker placeholders of "Meine
Beratungen" and "Archiv" (`/users/sessions/consultants/deleted-askers`) are
answered with none, so no real placeholder row shows in the practice lists.
A stale launch of the old card id reaches nothing. Proof:
`practiceTours.test.ts`, `Walkthrough.component.test.tsx`, the Einführung
runs in `PracticeFlow.integration.test.tsx` and the stories
`Organisms/PracticeFlow › Einführung …`.

**Supervision in practice (FE#2545).** The Supervision topic tour (Help →
Rundgänge → "Supervision") runs under the id of the old card F2,
`consultant-practice-supervision`, so no new id needs the UserService
allowlist, at version 2 (PO, 25 Nov): it shows as new for everyone, also
for counsellors who completed "Übung: Supervision hinzufügen". It exists
only as practice: no practice card and no explanation tour.
`TourOverviewSection` adds its card after "Fälle übergeben" where the
practice area is open and the tenant can offer it; below `fromXL` the card
shows `practice.cards.windowHint` (phone: `phoneHint`) instead of a start,
and where supervision or one-on-one supervision is off the card is hidden.
A stale launch request for it is cleared and runs nothing. The
practice start `supervision` is the open enquiry; its accept attaches the
standing supervisor Robin (Übung), as the server does for a standing
assignment, and the side room stays closed until the counsellor opens it
from the row icon. The counsellor finds the case by the "Supervision" chip,
writes in the side room (Robin answers from the script), swaps Robin for
Kim (Übung) with the real "Supervisor verwalten" dialog (`PUT
…/supervisors/{id}`, answered in memory, no notification to anyone, no
MSC4268 key share) and, where a supervision chat
allows a call (`resolveSupervisionCallFeatureGates`, the step's `anyOf`
condition), books a phone or video appointment with the supervisor from the
panel ⋮ (`POST /calendar/colleague-appointments` in memory; the notice goes
to the practice side room). No allowlist entry was added. After the swap
the practice world posts the server's swap notice into the practice side
room, locally in FakeMatrix: the same `[SYSTEM_NOTIFICATION]` payload type
`SUPERVISOR_REPLACED` with names and reason, drawn by the real message
chrome (`supervisorReplacedNotice.ts`, "Supervision gewechselt").
Proof: the Supervision tests in `FakeRestBackend.test.ts`,
`practiceWorld.test.ts`, `practiceTours.test.ts`, the two Supervision runs
in `PracticeFlow.integration.test.tsx` and the story `Organisms/PracticeFlow
› Supervision`.

Open decisions (Frank): a real incoming call cannot be answered while practising (end
practice on ring, or accept); the feed burst after the exit.

## Proof on Dev (T2)

`playwright/practice-network-guard.smoke.spec.ts` (helpers in
`playwright/practice-proof.ts`) walks the flows through the real UI of a
deployed build and checks, from outside the page, what the unit tests claim.
It skips unless `ORISO_TOUR_STORAGE_STATE` is set, and it needs a build of this
branch on Dev. It was dry-run against the Storybook stage only (selectors and
flow); it has **not** been run against a live environment.

```bash
ORISO_TOUR_STORAGE_STATE=/path/consultant-state.json \
PLAYWRIGHT_BASE_URL=https://dev.oriso.org \
ORISO_KEYCLOAK_TOKEN_URL=https://<keycloak>/auth/realms/<realm>/protocol/openid-connect/token \
npx playwright test practice-network-guard --project=chromium
```

| Env                           | Needed | Meaning                                                                                      |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `ORISO_TOUR_STORAGE_STATE`    | yes    | logged-in counsellor test account (storage state of the test-access hub)                     |
| `PLAYWRIGHT_BASE_URL`         | yes    | Dev frontend; `ORISO_APP_BASE_URL` also works                                                |
| `ORISO_KEYCLOAK_TOKEN_URL`    | yes    | token endpoint, the one allowed POST                                                         |
| `ORISO_TUTORIAL_PROGRESS_URL` | no     | when the user service has its own origin (default `<base>/service/users/tutorials/progress`) |

The spec forces `enableWalkthrough` and `releaseToggles.enablePracticeArea` on in
the `/service/settings` response of its own page only, opens Profile, Help,
"Meine Rundgänge", starts the tour card and drives the real controls. Per run,
from the card click to the end of the practice:

1. no write except the tutorial-progress PUT of the running tour (and the token
   refresh), and a PUT with status `completed` was sent (not for the half-way End);
2. no request URL or body names a practice id (`-1`, `practice-...`,
   `practice.invalid`), carries what was typed, or is a WebSocket publish;
3. localStorage, sessionStorage and the IndexedDB database names equal the
   snapshot before the start (differences are reported as key names, never values);
4. the real Anfragen list afterwards holds no practice id or name.

Runs: the Einführung as practice to the end (9 steps), the Einführung ended
half way from the banner, the Supervision topic tour to the end from its topic
card (skipped with a message when the tenant has no supervision; 12 steps with
the appointment, 11 where the supervision chat allows no call), and the
Einführung in a 899 px window, where the watch-only Einführung runs and no
practice starts. The run marks the account's Einführung and Supervision as
completed (the one allowed write): use a test account.

Limits: a pre-install `fetch`, form or link navigations and the real live-chat
heartbeat after the exit are outside the window (see Lifecycle). Real-mode
traffic before the card click and after the guard is off is not judged.
