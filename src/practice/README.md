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
`exitPracticeMode` runs them newest first, then removes the guard. Exit before
logout: the Keycloak logout is a POST and would be blocked. A JS guard cannot
cover form or link navigations, a pre-install `fetch`, or a replaced `window.fetch`.
