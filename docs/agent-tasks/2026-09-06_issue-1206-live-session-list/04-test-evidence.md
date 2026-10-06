# 04 — Test evidence (#1206)

Node 22.12.0, branch `claude/1206/live-session-list-updates` (from `upstream/dev` @ `501959f3`).

| Check                                                                                                                           | Result                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TDD RED                                                                                                                         | `Cannot find module './stompListRefresh'` and `'./liveListRefresh'` — both new suites failed to resolve before the modules existed |
| `npx vitest run --project unit src/components/app/stompListRefresh.test.ts src/components/sessionsList/liveListRefresh.test.ts` | **11/11**                                                                                                                          |
| `npx vitest run --project unit src/components/sessionsList src/components/app/stompListRefresh.test.ts`                         | 20 files / **125 tests**                                                                                                           |
| `npm run lint:scripts` (eslint + tsc)                                                                                           | pass                                                                                                                               |
| `npm run test:unit`                                                                                                             | **374/374 files, 4055/4055 tests**                                                                                                 |

## What the tests pin

**`stompListRefresh.test.ts`** — which live events change list _membership_:

- `newAnonymousEnquiry` → enquiry list only
- `anonymousEnquiryAccepted` → **both** lists (the #1206 regression: it used to refresh neither)
- `anonymousConversationFinished` → both lists
- the ALL-CAPS spellings the backend also sends resolve identically
- `directMessage`, `videoCallRequest`, `''`, `undefined` → `null` (no refetch)

**`liveListRefresh.test.ts`** — the unknown-room case and the burst guard:

- a room already in the list (as `session` or as `chat`) is known
- a brand-new room is **unknown** — the exact condition under which `touchSessionsByRids` silently dropped the event
- empty room id / empty list / undefined list never claim knowledge
- the throttle allows the first refresh, blocks a burst inside the window, allows the next one after it, and separate throttles stay independent

## Not covered here (stated plainly)

- **AC3 asks for an E2E test.** This repo deliberately keeps Cypress and the Playwright smoke out of CI because the app's bootstrap needs a reachable backend (see the note in `.github/workflows/ci-pull-request.yml`). Adding an E2E that CI cannot run would be dead weight, so the logic is covered by the unit tests above and the two-browser scenario stays in the reviewer test plan.
- The live two-browser run (asker enquiry → counsellor list updates without reload) needs two logged-in accounts on dev; it is the first item of the reviewer test plan.
