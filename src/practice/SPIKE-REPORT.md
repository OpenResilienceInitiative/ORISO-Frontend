# S0 spike report: practice area on the real containers (FE#1622)

**Gate: PASS.** The real wired containers run unmodified on in-memory fixtures in
the same page, with the real Matrix service still registered and never touched.

## Verdict per gate criterion

Proof: `src/practice/PracticeSandbox.integration.test.tsx` (real `SessionsZone` +
`RouterConfigConsultant`, `MemoryRouter`, minimal real providers). Run:
`npx vitest run --project unit src/practice`.

| Criterion                                                                                                                | Verdict | Test                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------- |
| Real enquiry list shows only the practice enquiry; real click opens it                                                   | PASS    | `F1: lists only the practice enquiry…`             |
| Real `AcceptAssign` click: fake got the PUT, case IN_PROGRESS, real refresh + navigation to `sessionView/!practice-1…`   | PASS    | F1                                                 |
| Session view shows asker message and Erstantwort from the fake room                                                      | PASS    | F1                                                 |
| Free-typed reply via the real TipTap composer appears; scripted asker answer follows                                     | PASS    | F1                                                 |
| No practice endpoint and no non-GET on the network; no storage write; no IndexedDB; real Matrix untouched; no feed entry | PASS    | all journeys (`expectNothingLeftThePracticeWorld`) |
| Team discussion: side panel with colleague message, reply lands in team room only                                        | PASS    | `team discussion: …`                               |
| Supervisor add: picker lists only Robin, POST applied, system note, scripted reply in side room                          | PASS    | `supervision: …`                                   |
| …reply visible in the side panel without reopening the case                                                              | PASS    | S6: `supervision in practice mode: …` (finding 1)  |
| Composes with S1 `NetworkGuard`: nothing blocked, layers unwind in order                                                 | PASS    | `F1 under the real network guard…`                 |
| Sandbox lifecycle: StrictMode, restore, drain on unmount, restart, storage spies                                         | PASS    | `PracticeSandbox.test.tsx`                         |

Only browser gaps are substituted (canvas `getContext`, `lottie-web`/`lottie-react`,
`matchMedia`, `ResizeObserver`, `scrollIntoView`/`scrollTo`). No component and no
API module is mocked. Pollers (3/4/10/15 s) never fire within the journeys
(< 1.5 s). When they do fire, the fake answers them (view-wide routes) or they are GETs.

## Real-component edits (guards only)

| File:line                                                            | Size     | Why                                                                                                       |
| -------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `services/matrixClientRegistry.ts:15-26`                             | +13      | WeakSet marker `markSandboxedMatrixClient` / `isSandboxedMatrixClient`                                    |
| `hooks/useNotificationSettings.ts:26-27`                             | +2/-1    | never bind the global settings store to the fake (it called `setAccountData` and stayed bound after exit) |
| `utils/observability/utdTracker.ts:236-239`                          | +3 logic | keep UTD telemetry on the real client while practising                                                    |
| `utils/channelRoute.ts:434-435`                                      | +2       | `writeLastChannel` skips negative ids (sessionStorage `chatStage.lastChannel.<id>`)                       |
| `messageSubmitInterface/messageSubmitInterfaceComponent.tsx:652-653` | +1/-1    | no audience-selection key for negative ids (localStorage `oriso.audienceSelection.<id>`)                  |

## Singletons and bypasses

Neutralised by the sandbox:

- `fetch` (fake layered on top; drains practice-addressed calls after unmount)
- Matrix context + registry (save/restore). `MatrixClientProvider` is never mounted, so `feedbackMailIntentQueue` never starts, and event ids carry no `$`.
- `window.__activeSessionContext` (writes swallowed)
- `SessionsDataContext` (fresh store)
- `TopicsContext` (practice topic only; the unknown topic id posted a warning to `/error-reports` on every render)
- `NotificationsContext.addEventNotification` (swallowed; supervisor-added and thread-reply entries would enter the real feed; toasts stay)
- `lastOpenSession` (its regex already rejects negative ids; pinned by a test)

Open, not fixed in S0:

1. **Supervision side room is resolved on session change only.** It lives in `SessionStream.tsx:355-402` and `SessionItemComponent.tsx:884-951`, and this is real-product behaviour. _Closed in S6 for practice:_ the header announces a successful add (`notifyPracticeSupervisorsChanged`, `practiceSupervisionRefresh.ts`) and both lookups re-run; outside practice the signal stays 0, so the product is unchanged.
2. **Invariant 5, UI half (closed in S6, `usePracticeActive`).** The composer shows the voice and attachment buttons (2 file inputs), and `SessionMenu` shows calls when the counsellor's consulting type allows video. Uploads go through `sendFileMessage`, which the fake refuses, and the S1 guard blocks a call-start POST. Hiding the controls needs `usePractice()` in the composer (`hasUploadFunctionality`, line 2220, plus the voice gate) and in `SessionMenu`. That is integrator or S7 work.
3. **Real GETs from inside the practice view.** All read-only and about the counsellor's own settings, not case data. Decide whether practice may show them.
    - `/service/agencies/<real id>` (`useCounsellorAgencyFormats`, `SessionsList.tsx:262`)
    - `/service/conversations/consultants/availability`
    - `/service/tenant/public/`
    - `/static/anon-animals/*.svg`
4. **Other session-keyed storage writers.** Example: `anonymous-waiting-dismissed-<id>`, which is anonymous chats only. They are not exercised by these journeys; S1's T2 smoke with `assertNoPracticeWrites` should cover the rest.

## Layering contract (integrator)

1. `enterPracticeMode()` (the guard installs) BEFORE `<PracticeSandbox>` mounts. The default `baseFetch` is then the guarded fetch. The other way round, the guard would sit on top and block the fake's accept PUT.
2. Unmount the sandbox, wait one macrotask (drain), THEN `exitPracticeMode()`.
3. One sandbox per page (module singleton). Use `usePracticeSandbox().restart()` for fresh fixtures.

## Recommendation

**Same-page sandbox.** All five containers run unchanged, and the leaks are few, each found by a red test and closed by five small guard edits. An isolated window and the static fallback are not needed.
