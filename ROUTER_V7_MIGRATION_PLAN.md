# React Router v5 → v7 migration + smoke-test hardening — Plan

**Repo:** ORISO-Frontend  **Branch:** `refactor/react-router-v6-migration` (off `origin/dev`)
**Worktree:** `~/ORISO/_worktrees/ORISO-Frontend-router-v6`
**Decisions:** target **react-router v7**; scope = router + adjacent quick wins (native `useSearchParams`); add a **Playwright CI job**; build now, **rebase after `fix/login-router-input-component` lands**.

> React is already 19. The only legacy piece is `react-router-dom ^5.3.4`. This is a *focused modernization PR*, not a blind big-bang — driven by a full route inventory (below) and a smoke-test net.

---

## 0. Why this is one atomic PR

`react-router-dom` v5→v7 is a single dependency version. The moment it bumps, **all 8 `<Switch>`, 9 `<Redirect>`, 40 `useHistory`, 2 `useRouteMatch`, and the `matchPath` call break at once**. You cannot merge it to `dev` half-done. So: **one branch, many small green commits, lands as one PR.** "Zwischenschritte abspeichern" = frequent commits on the branch, not partial merges.

(De-risking fallback, only if the atomic branch won't stabilise: land the dep bump + shell on the official `react-router-dom/v5-compat` shim first, then mop up `useHistory` callers in a follow-up. Costs a transitional dependency that itself must later be removed — contradicts "remove legacy patterns" — so it's plan B, not plan A.)

---

## 1. Route inventory (baseline)

| Legacy pattern | Count | v7 change |
|---|---|---|
| `useHistory()` | 40 files | `useNavigate()`; `push`→`navigate`, `goBack`→`navigate(-1)`, `replace`→`{replace:true}`, object-form `{pathname,state}` preserved |
| `<Switch>` | 8 blocks | `<Routes>` (exact-by-default; non-exact → trailing `/*`) |
| `<Redirect>` | 9 | `<Navigate replace>` (incl. `from="*"` catch-all → `<Route path="*">`) |
| `render=` / `component=` | 5 (Routing.tsx) | `element=`; drilled `type` via `SessionTypeProvider` context, `logout` via `<Outlet context>` |
| optional params `:x?` | ~5 routes | split into explicit routes (+ index route for registration) |
| `useRouteMatch` | 2 (Registration, RegistrationProvider) | derive base path from `useParams`/`useLocation` |
| `matchPath` | 1 (listItemSelection.ts) | **arg order reversed**, `exact:false`→`end:false` — HIGHEST silent-risk |
| `<NavLink activeClassName>` | 2 (Profile, BookingEvents) | `className={({isActive})=>...}` |
| custom `useSearchParam` hook | 16 call sites | native `useSearchParams` |
| `window.location` | ~36 | mostly KEEP (genuine full reloads: logout, redirectToApp, Keycloak, invite, pw-reset, Safari HTTPS); only ~4 query *reads* → `useLocation`/`useSearchParams` |

`history.listen` — **none** (the hardest v5 pattern is absent).

## 2. Architecture (settled)

- **Declarative `<BrowserRouter>` + `<Routes>`**, NOT the data router (`createBrowserRouter`). Route table is runtime-dynamic per user authority; data router would be a far bigger rewrite for no gain.
- **app.tsx `RouterWrapper`:** providers move *above* `<Routes>` (they use no routing hooks); `<Redirect from="/" >`→`<Route path="/" element={<Navigate replace/>}>`; `AuthenticatedApp` becomes `path="*"`. extraRoutes precedence preserved (v7 = best-match; after the optional-param split the specific step routes still win). **Careful:** the hardcoded `/registration` (old `Registration`) and the extraRoute `/registration/:step` (`NewRegistration` = wraps `RegistrationProvider`) are NOT identical — preserve both, do not naively collapse.
- **Routing.tsx:** one **layout route** rendering the shell (NavigationBar/Header/footers) + `<Outlet context={{logout}}>`; content `<Routes>` dispatches zones. The two-column session view = two independent `<Routes>` (list + detail) matching the same URL — valid in v7. Extract `SessionsZone.tsx`; add `routeHelpers.ts` (`splitOptionalParams`, `stripPrefix`).
- **Registration.tsx / RegistrationProvider.tsx:** drop `useRouteMatch`; build step URLs from `useParams` (`topicSlug ? '/'+topicSlug+'/registration' : '/registration'`) + `useLocation().search`; inner `<Switch>`→`<Routes>` with `index`(WelcomeScreen) + `:step`.

## 3. Test pyramid ("viele Smoke Tests, automatisch")

CI today enforces only `npm run test:unit` (vitest). So automated = vitest + new Playwright job.

1. **`src/test-utils/renderWithRouter.tsx`** — `MemoryRouter` + a shared provider wrapper factored from `.storybook/preview.tsx` (asker/consultant stubs that drive `RouterConfigUser`/`Consultant`).
2. **Route-tree smoke suites** (vitest+jsdom, lazy components `vi.mock`'d to `data-testid` stubs): render the real tree at each critical path, assert the right component mounts —
   `/login`, `/registration`(index), `/registration/:step`, `/:topicSlug/registration`, user+consultant session deep-links (Matrix `…/session/:id` AND RC `…/:rcGroupId/:id`), `/invite/:token`, video routes, `/profile`, `/404`, and the `*` redirect.
3. **Navigation unit tests** (spy on `navigate`): Registration step advance, SessionListItem click (Matrix+RC), AcceptAssign post-accept, TwoFactorNag state push, VideoCall `navigate(-1)`, logout boundary.
4. **Playwright smoke** (`playwright.config.ts`, `webServer: npm run dev`@9001, `page.route()` mocks like Cypress): login↔registration, registration steps, public routes. New `.github/workflows` PR job (`needs: build`, `playwright install --with-deps chromium`). Feature-branch CI stays fast (unit only).
5. **Cypress (27 specs)** left as-is (local only) — Playwright = thin migration smoke, no overlap.

## 4. Build sequence (commits on the branch)

- **P0 (non-breaking, before the bump):** add `renderWithRouter` + `routeHelpers.ts`; scaffold `playwright.config.ts` + empty spec dir. `test:unit` stays green on v5. ← *first reviewable increment, shown back to Frank.*
- **P1:** bump `react-router-dom`→v7, drop `@types/react-router-dom`. **Fix `listItemSelection.ts` matchPath first**, run its unit tests.
- **P2:** app.tsx + AuthenticatedApp + initApp `/themen`.
- **P3:** Routing.tsx (+ SessionsZone) + the 5 `render=`→`element=` + `Outlet` context.
- **P4:** Registration.tsx + RegistrationProvider.
- **P5:** the 40 `useHistory`→`useNavigate` files, in themed batches (sessions, registration, booking, profile, video, notifications); `<Redirect>`→`<Navigate>`; `NavLink className`; BookingEvents/Profile inner Switches.
- **P6 (adjacent quick wins):** custom `useSearchParam`→native `useSearchParams` (16 sites) + ~4 `window.location` query reads.
- **P7:** route-tree smoke + navigation unit tests green; Playwright specs + CI job.
- **P8:** rebase onto updated `dev` (after login fix), open PR (English; ADR note if warranted), `/code-review`, then PreDev + E2E with the browser "Zeiger".

## 5. Verification ("dein Zeiger")

After P3/P4 and again at P7: drive the running app (Playwright/Preview pointer) against the dev server for: `/registration`→`/login`→`/registration`, registration steps, session view (Matrix + RC), invite link, video/call, password-reset/2FA. Capture screenshots into the prompt-log assets.

## 6. Highest-risk items to watch

1. `matchPath` arg reversal (silent — breaks session-list active highlighting). Fix + test first.
2. Providers now mount for public routes too (`/login`, `/registration`) — verified they use no routing hooks; confirm `WebsocketHandler` gating still holds.
3. Two-column parallel `<Routes>` both matching the same URL.
4. Legacy-vs-new registration route coexistence (precedence + which wraps `RegistrationProvider`).
5. vitest+jsdom has no SCSS transform → smoke tests must `vi.mock` lazy/SCSS-importing children (existing test convention).
