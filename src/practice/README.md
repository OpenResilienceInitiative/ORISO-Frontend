# Practice area (Übungsbereich), safety core

Frontend-only simulation, spec `0 - Docs/SPEC-practice-area-guided-flows-2026-10-06.md`
sections 4 and 5. Two claims must stay provable:

1. **No mutating request leaves the page in practice mode.** `NetworkGuard`
   wraps `fetch`, `XMLHttpRequest` and `navigator.sendBeacon`. GET, HEAD and
   OPTIONS pass; every other request is blocked (fetch rejects with
   `PracticeBlockedRequestError`, XHR errors out, beacon returns `false`) and
   counted by method and URL, never query or body. Proof: the guard's unit
   tests (`networkGuard.test.ts`) and the runs of both flows that record every
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

**Required actions.** Both practice tours use `requiredTargetPolicy: 'stop'`.
A missing required control interrupts the run without a terminal progress
write; it cannot fall through to the explanations and record completion.
Regular tours keep their existing missing-target skip policy. Proof:
`ProductTourAdapter.component.test.tsx` records the progress HTTP boundary for
F2 with absent controls, and `tourEngine.test.ts` covers a disappearing target.

**Window size.** F1 starts in the real controls' `fromL` layout; F2 needs
`fromXL`, where the real supervisor plus is interactive. A narrower F2 card
explains that the browser window needs widening, and the tour host rejects a
stale launch request too. Resizing below the supported range discards that
request, so widening the window requires another deliberate Start. The phone
hint and F1's existing range are preserved.
Proof: `PracticeOverviewSection.test.tsx` checks 1199/1200 and F1 at 1024;
`PracticeFlow.integration.test.tsx` checks the actual host boundary.

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
the real contexts. Proof: `PracticeFlow.integration.test.tsx` walks F1 (both
variants) and F2 through the real navigation bar, header, banner and tour host.

**Permanent controls.** The banner uses a page-level portal and the theme's
tooltip layer, above the supervisor dialog's modal layer. The picker and banner
share a focus trap, so End remains accessible by pointer, keyboard and screen
reader while the picker is open. The dropdown stays inside the dialog's
container, so its modal manager does not hide the banner. Proof:
`PracticeFlow.integration.test.tsx` and local Chromium picker captures.

Known limits: while practising, `/service/error-reports` is answered
by the fake, so an error report from a practice run is not sent. The real reads
in the table below were reviewed by hand; no test pins them.

| Outside the sandbox                                       | Shows                                                                       | Decision                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Navigation bar links, `/notifications` badge              | labels; an own unread number                                                | accept: no case data; the app-level sessions store is never written                        |
| Zeitstrahl feed (`/notifications`, inside the outlet)     | real rows with asker names and links                                        | neutralised: the sandbox blanks the feed and its actions                                   |
| Header title, claim, agency logo                          | tenant; the practice agency while a practice case is open                   | accept                                                                                     |
| Header UI version switch                                  | one click opens Element with every real room                                | neutralised: hidden while practising                                                       |
| Toast host, sound, OS banner                              | toasts of the practice views; real feed events after the exit, in one burst | accept (generic titles, no names)                                                          |
| JoinRequestCenter snackbars                               | real colleague names and group titles                                       | accept: not case data; admit/decline fail while practising                                 |
| Incoming real calls (FloatingCallWidget, GroupCallWidget) | ringing, asker initial                                                      | accept for now: answering fails while practising (decision below)                          |
| Live-chat availability heartbeat                          | nothing until it lapses                                                     | accept for now: the blocked POST drops availability after about 2 minutes (decision below) |
| Language switch, mute bell, absence overlay               | own settings                                                                | accept: the server write is blocked while practising                                       |

Open decisions (Frank): a counsellor who is live-chat available drops out after
about 2 minutes of practice (allowlist the heartbeat, or switch live chat off
at the start); a real incoming call cannot be answered while practising (end
practice on ring, or accept); the feed burst after the exit.

## Proof on Dev (T2)

`playwright/practice-network-guard.smoke.spec.ts` (helpers in
`playwright/practice-proof.ts`) walks both flows through the real UI of a
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
"Meine Rundgänge", starts the card and drives the real controls. Per run, from
the card click to the end of the practice:

1. no write except the tutorial-progress PUT of the running tour (and the token
   refresh), and a PUT with status `completed` was sent (not for the half-way End);
2. no request URL or body names a practice id (`-1`, `practice-...`,
   `practice.invalid`), carries what was typed, or is a WebSocket publish;
3. localStorage, sessionStorage and the IndexedDB database names equal the
   snapshot before the start (differences are reported as key names, never values);
4. the real Anfragen list afterwards holds no practice id or name.

Runs: F1 to the end, F1 ended half way from the banner, F2 to the end (skipped
with a message when the tenant has no supervision). F1 has eight steps with the
Träger's Team-Besprechung and six without; the run reports which variant the
tenant has, so the other one needs a tenant with the other setting. The run marks
the account's practice tours as completed (the one allowed write): use a test
account.

Limits: a pre-install `fetch`, form or link navigations and the real live-chat
heartbeat after the exit are outside the window (see Lifecycle). Real-mode
traffic before the card click and after the guard is off is not judged.
