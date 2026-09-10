# Supervision integration branch — hand-over and TODO

**Created 2026-09-10.** One branch per repository carrying the complete supervision
feature, ready to be worked on, reviewed and split into PRs.

| Repository | Branch | Base | Size |
|---|---|---|---|
| ORISO-Frontend | `integration/supervision-20260910` | `origin/dev` @ `30ff2bb0` | 142 commits, 177 files |
| ORISO-UserService | `integration/supervision-20260910` | `origin/dev` | 11 commits, 36 files |

```bash
git fetch origin && git checkout integration/supervision-20260910
```

Both branches merge into today's `dev` **without conflicts**. That is the point of
them: the one collision in this feature is already resolved here (see §2).

---

## 1. What is on the branch

### Wired — reachable in the running application

| Package | What it does | Key files |
|---|---|---|
| **Supervision side pane** | Supervision room and threads as a second pane beside the client chat; `?channel=supervision` / `?channel=thread:<id>` is the single source of truth; headers show only real participants (ADR-002); failed sends belong to one room | `src/utils/channelRoute.ts`, `src/components/chatStage/`, `src/components/message/visibleParticipants.ts` |
| **List marker** | Supervision chip driven by the ADR-008 marker instead of the eye + handover heuristic; no raw JSON in `INTERNAL_GROUP`; unknown modality survives | `src/components/sessionsListItem/`, `src/components/sessionsList/SessionsListToolbar.tsx` |
| **Stage width + side-room calls** | The drag divider reaches 320 px on either side; audio/video buttons in the side room at chat-header size | `src/components/chatStage/PanelCallActions.tsx`, `src/resources/styles/_headerCallButtons.scss` |
| **Session rail pills** | Portrait 48 px pill per session with stacked marks; tooltips to the right up to 220 px, date bottom-right; the unread mark carries the number ("99+" cap); 40 px avatar without the ring | `src/components/sessionsList/SessionRailPill.tsx`, `sessionRailPill.styles.scss` |
| **Team counselling channel** | Third channel beside client chat and supervision, with a permanent "team only" marker | `src/components/chatStage/teamChannelCopy.ts`, `channelMenuModel.ts` |
| **Backend (UserService)** | `SessionService` no longer derives `INTERNAL_GROUP` from `is_team_session`; session lists carry the ADR-008 marker, the counsellor's internal display name and the consultant Matrix id; changeset `0091` repairs rows already written wrong | `SessionService.java`, `SessionMapper.java`, `SessionSupervisionMarkerService.java` |

### Deliberately NOT on this branch

`SupervisorDialog`, the four Erstantwort modules and the handover-consent element are
**Storybook only** — no product path renders them. They would only inflate the review
surface. They live on `chore/storybook-sammel-20260909` and are visible at
`https://predev.oriso.org/storybook-frontend/`.

Also excluded: `fix/connect-asker-email-tenant-switch` (that is PR #1331, its own
review) and `feat/1341-entry-room-updates` (entry-room line).

---

## 2. The one conflict, and why it is already solved

`dev` moved the anonymous waiting area from the mini game to the **breathing companion**
(PR #1333, commits `2214b855` / `aaf40019`) and writes it into exactly the render region
the side pane rebuilt. Three blocks collided in two files:

- `SessionItemComponent.tsx` — the pane structure was kept and dev's three additions were
  put back inside the anonymous branch: `PrivacyMessageCard`, the `gameChromeFadeTarget`
  wrapper around `EncryptionBanner`, and the `waitingCompanionInline` region hosting
  `BreathingCompanionHost`. The registration button now opens the companion
  (`setShowWaitingMiniGame`) instead of navigating away, as on `dev`.
- `session.styles.scss` — dev's removal of the mini-game rules was kept, and so was this
  branch's removal of `session__supervisionReason` (the `InfoBanner` organism replaced it).

Merge commit: `6de4d29f`. **If you ever need to redo this**, the check that proves a
resolution correct is:

```bash
git diff chore/storybook-sammel-20260909 -- src/components/session/SessionItemComponent.tsx
```

Only `PanelCallActions`, `teamChannelCopy` and `teamChannelTitle` may remain — those are
the follow-up packages. Anything else means the resolution is wrong.

---

## 3. Verification status (measured 2026-09-10, not assumed)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx tsc -p tsconfig.storybook.json --noEmit` | clean |
| `npm run lint` (ESLint + tsc + Stylelint) | exit 0 |
| `npx vitest run --project unit` | **4566 / 4566**, 428 files |
| `npx vitest run --project storybook` | 1115 / 1116 — one flaky story, see §5.1 |
| UserService focused tests (JDK 21) | **142 / 142** |
| Merge into `origin/dev` | no conflicts |

Deployed and exercised on pre-dev on 2026-09-10 as
`oriso-frontend:supervision-f31b620a` + `oriso-userservice:supervision-3ffaaa5f`
(4 h pin). The served bundle was verified to contain the new code, not a cached build:
`app.6d23adec.js` matches the image byte-for-byte and chunk `218.6c7a330e.chunk.js`
carries `supervisedByMe`, `chatStage__panel` and `side-panel-timeline`.

Liquibase changeset `0091-team-agency-session-modality` had already run on pre-dev on
2026-09-04, so the data there is repaired.

---

## 4. TODO — ordered by what unblocks the most

### 4.1 Land the feature

- [ ] **Point PR #1303 at this branch, or open its replacement from it.** #1303 is
      currently `CONFLICTING` because it lacks the merge in §2. It has **62 unresolved
      CodeRabbit threads (52 on current code)** and **no human review yet** — reviewers
      Hassan9215 and shazia-k were requested and have not responded.
- [ ] **Work the CodeRabbit findings.** This is the real remaining effort, not the merge.
- [ ] **Get the UserService branch reviewed and merged.** PRs #1112 (base `pre-dev`,
      Draft, `CONFLICTING`) and #1113 (base `dev`, Draft, mergeable but with **zero
      requested reviewers** and "Do not merge as-is" in its body) both stall. The
      integration branch supersedes both: it merges cleanly onto `dev`.
      Without it the frontend cannot be exercised — the modality bug is still on `dev`
      **and** on `pre-dev` (`SessionService.java:293` still reads
      `? ConversationType.INTERNAL_GROUP`).
- [ ] **Decide the split.** Suggested: keep the supervision pane + list marker as one PR,
      then stage width + calls + rail pills, then the team channel. All follow-ups sit on
      top of the pane, so once it is on `dev` they merge without further conflict work.

### 4.2 Fix before merge

- [ ] **Rename one of the two `0091` changesets.** This branch adds
      `db/changelog/changeset/0091_team_agency_session_modality/`; branch
      `origin/fix/1130-call-tenant-stamping` adds `0091_group_session_tenant/`. They do
      not collide on `dev` today, but whichever merges second must be renumbered.
      Liquibase itself tolerates it (the ids differ) — the directory convention does not.
- [ ] **Stabilise `ChatStage.stories.tsx`.** One focus assertion fails at random:
      measured **1 in 3 on the source branch, 2 in 3 on the integration branch**, and a
      *different* story each run. Root cause: the ProseMirror editor takes focus while the
      story asserts that focus sits on `[data-cy="panel-header-channel-options"]`. Either
      wait for the editor to settle before asserting, or — the better question — decide
      whether the composer should grab focus at all when a pane opens, because in the real
      app the same steal happens to the user.
- [ ] **Add `GET /{sessionId}/supervisors` to `api/userservice.yaml`.** The controller
      exists (`SessionSupervisorController.java:211`) and returns `supervisorMatrixUserId`
      and `matrixRoomId`, but the OpenAPI spec does not describe it, so the generated
      client never gets it. The frontend hand-types the interface in
      `src/api/apiGetSessionSupervisors.ts` — two definitions that can drift apart.

### 4.3 Complete the feature

- [ ] **Expose `supervision.sideRoomId` on the session list DTO.** Marked as
      `TODO(B3, UserService)` in `src/components/sessionsListItem/matrixRoomPreview.ts:19`.
      Without it the rail tooltip and the list preview cannot read the supervision room
      ahead of time.
- [ ] **Move the team-counselling words into the i18n catalogues.** Nine keys live in
      `src/components/chatStage/teamChannelCopy.ts` as injected fallbacks, so the team
      channel currently reads **German in every language**. This is deliberate — the i18n
      guard (`src/i18n.test.ts`) runs a drift budget of **0** for `fr/ru/ti/tr`, so a
      German key without all five translations turns the unit gate red. The keys are named
      by analogy to the supervision ones (`chatStage.panel.team.*`) so the catalogues can
      be filled in one pass.
- [ ] **Decide the feature flag for supervision calls.** They currently ride the
      client-facing call gate, so an advice centre without client calls silently loses
      supervision calls too.

### 4.4 Wire what already exists (smaller than it looks)

- [ ] **Wire `SupervisorDialog` to the existing case-handover API.** The backend is
      **already complete** — this was verified in code, not assumed:
      - `GET /users/case-handover/reasons`
      - `GET /users/case-handover/candidates`
      - `POST /users/case-handover/batch` — takes `reasonCode` **and** `explanation`
      - `resolveClientConsent(sessionId, requestId, approved)` — the consent gate
      - `GET /users/case-handover/logs` — the audit trail

      `CaseHandoverReasonPolicy` carries `clientConsentRequired`, `accessAllowed`,
      `enabled`, `displayOrder` and per-reason client notification templates. The reason
      codes used in the dialog (`COUNSELLOR_ON_HOLIDAY`, `COUNSELLOR_IS_ILL`,
      `COUNSELLOR_LEFT`, `OTHER_EMERGENCY`, `LEGAL_PROTECTION`) are exactly the backend's,
      and the frontend already lists all three endpoints in `resources/scripts/endpoints.ts`.
      **There is no backend ticket here.** The dialog needs to call what is there.
- [ ] **Note the difference between the two reason sets.** `SupervisionReason`
      (`PEER_SUPPORT`, `CLINICAL_OVERSIGHT`, `SAFEGUARDING_U25`, `TRAINING`, each with
      `clientConsentRequired`) is why a *supervisor* is added — not why a *case* is handed
      over. Do not mix them.

---

## 5. Known issues, so nobody rediscovers them

1. **Flaky focus story** — see §4.2. Not introduced by the integration; present on the
   source branch too.
2. **Two `0091` changesets** — see §4.2.
3. **Team channel is German-only** — see §4.3, deliberate.
4. **`supervisorMatrixUserId` is not a DTO field of the session list.** It comes from
   `GET /{sessionId}/supervisors`, and `matrixRoomId` from the same call is what the
   frontend uses as the side-room id. This works; it is only undocumented (§4.2).

---

## 6. Product decisions still open (Frank)

- [ ] Release the 27 `SupervisorDialog` strings for translation. Because of the zero drift
      budget this is all-or-nothing across five languages.
- [ ] Keep or drop the greyed-out legal handover reason (`LEGAL_PROTECTION`).
- [ ] Which feature flag governs supervision calls (§4.3).
- [ ] Are the Erstantwort modules a product epic or a design draft that may age out?
      131 stories exist; no product path renders them.

---

## 7. Testing on pre-dev

```bash
ssh predev "predev-pin set frontend  ghcr.io/openresilienceinitiative/oriso-frontend:<tag> 4"
ssh predev "predev-pin set userservice ghcr.io/openresilienceinitiative/oriso-userservice:<tag> 4"
ssh predev "predev-status"           # what runs where, and how long the pin holds
ssh predev "predev-pin release frontend; predev-pin release userservice"
```

A pin protects a test image from the 15-minute auto-sync and expires on its own.
**A locally imported image needs `imagePullPolicy: IfNotPresent`** — `predev-pin set`
writes `Always`, which cannot pull an image that exists only in containerd.

Accounts (tenant 1; tenant 40 is dead): `sv_berater_a` (Mona Simpson, counsellor),
`sv_supervisor` (Bettina Berg, standing supervisor), `sv_berater_team` (Stampy Elephant,
team advice centre).
