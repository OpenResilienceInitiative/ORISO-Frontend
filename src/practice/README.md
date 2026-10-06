# Practice area (Übungsbereich), safety core

Frontend-only simulation, spec `0 - Docs/SPEC-practice-area-guided-flows-2026-10-06.md`
sections 4 and 5. Two claims must stay provable:

1. **No mutating request leaves the page in practice mode.** `NetworkGuard`
   wraps `fetch`, `XMLHttpRequest` and `navigator.sendBeacon`. GET, HEAD and
   OPTIONS pass; every other request is blocked (fetch rejects with
   `PracticeBlockedRequestError`, XHR errors out, beacon returns `false`) and
   counted by method and URL, never query or body. Proof: T1
   (`networkGuard.test.ts`), T2 (`playwright/practice-network-guard.smoke.spec.ts`,
   built on `assertNoPracticeWrites`).
2. **Practice state lives in memory only.** No localStorage, sessionStorage or
   IndexedDB (T8, `PracticeProvider.test.tsx`). Practice ids are negative,
   `practice-...` or `...:practice.invalid`, so never a real id (`practiceIds.ts`).

## Allowlist (exact, fetch only)

- `PUT` to `endpoints.tutorialProgress` (no query), JSON body with
  `surface: "frontend"` and the `tourId` of the running practice tour.
- `POST` to `endpoints.keycloakAccessToken` with `grant_type=refresh_token`,
  `client_id=app` and no credentials. The password grant shares the URL: blocked.
- Unparseable, unreadable or oversized bodies fail closed. XHR and beacons get no
  exception. SigNoz/OTLP exports are blocked (non-essential). WebSocket is not
  wrapped (the app only receives on it); T2 asserts the claim from outside.

## Adding an endpoint to the allowlist

You must not. The list is the spec (section 4); a new entry needs a spec change
decided by Frank, plus tests in `networkGuard.test.ts` and
`assertNoPracticeWrites.test.ts`. Practice endpoints are answered by the fake
backend (S2) and never reach the network.

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

**Restart.** The banner asks the tour host for a new run of the same tour. The
host ends and re-enters on the running guard; the re-enter runs the restart
handlers, and `PracticeSandboxSlot` registered the sandbox's `restart` there:
fresh fixtures, tour from step 1, same guard.

**Routes.** While practising, a real case route leads to the practice enquiries;
outside practice, a practice case route does (Back after End). A request that
carries a practice id in its path or query never reaches the network: the
fake answers it, or the sandbox answers 404.

## What stays real

The sandbox wraps the routed content only (`<Outlet/>` in `Routing.tsx`): the
case views get the fake Matrix service, the practice sessions store, topics and
notifications. Its `fetch` patch is page-wide, so the shell's requests for
practice endpoints are answered from memory too. The shell around it stays on
the real contexts. Proof: `PracticeFlow.integration.test.tsx` walks F1 (both
variants) and F2 through the real navigation bar, header, banner and tour host.

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
