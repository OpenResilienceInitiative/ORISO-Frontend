# 01 — Spike (#1188)

Verified on `upstream/dev` @ `85c6d208` (which now contains PR #1314 and, through it, the #1193 avatar work).

## Job 1 — "Fall Übergabe" → 404, and "Advice seeker profile" dead end

- **"Fall Übergabe" does not exist in this repository.** Own pickaxe over every ref (`git log --all -S "Fall Übergabe"`) → zero commits; the string is in no i18n catalogue and no menu entry. The chatroom-settings menu is `src/components/sessionMenu/SessionMenu.tsx`; its complete entry list is advice-seeker profile (⇧P), notification settings, supervisor manage (⇧S, mobile), end anonymous chat (⇧E), delete account (⇧D, anonymous), archive/dearchive (⇧A), delete session (⇧D), and the group-chat entries (⇧L/⇧I/⇧E/⇧G). No handover entry, no ⇧Ü. "Request Advice" exists but is hard-disabled (`ADVICE_REQUEST_ENABLED = false`).
- Case handover in this build is reached from the **session-list card** (`CaseHandoverActionButton`) and the in-chat curtain (`CaseHandoverCurtain`), never from the chatroom-settings menu — consistent with the archaeology note that the reported entry comes from outside this repo's refs (the report was taken on v2.0.3).
- **The profile entry is not a dead end here.** `SessionMenu` builds its targets with `generatePath` on `${listPath}/:groupId/:id/:subRoute?/:extraPath?` (or `session/:id/...` when the enquiry has no Matrix room). Matrix room ids carry `!` and `:`; react-router 7.18 percent-encodes the `:` (`!qOTUe…%3Amatrix.oriso.org`) and the route still matches — proven by the new cases in `SessionsZone.routing.test.tsx`, which render the real `SessionsZone` at exactly the generated links and get the profile view.
- **Deliverable:** no code change is justified; instead a regression guard so a route rename can never silently reintroduce the 404 (AC1).

## Job 2 — handover system message

- Already resolved on dev. `05175d2a` (PR #1055) is contained in `upstream/dev` via the sync PR #1178 (merged 2026-08-31) — verified with `git merge-base --is-ancestor`.
- Path: `MessageItemComponent.tsx` detects `SYSTEM_NOTIFICATION_CASE_HANDOVER_GRANTED` (parsed in `message/messageConstants.ts`) and renders `CaseHandoverSystemMessageBody` (`caseHandover/CaseHandoverClientCards.tsx`) — robot (Carimat) avatar, bold headline, subtitle, styled bubble carrying `reasonLabel` + `explanation`, timestamp, left aligned. No raw-JSON or unstyled fallback branch exists for handover messages.
- Storybook proof captured at desktop and 320px: `screenshots/01-job2-*`, `02-job2-*`, `03-job2-*`.
- **Deliverable:** verification only, no code change (the issue explicitly asks to "verify on dev after the sync, then only fix remainders"; no remainder found).

## Job 3 — advice-seeker profile shows a generic person glyph

- `src/components/askerInfo/AskerInfo.tsx` rendered `PersonIcon` (`resources/img/icons/person.svg`) in `.askerInfo__icon`.
- The session list (`SessionListItemComponent.tsx`) derives its avatar from `askerMatrixUserId || user.username`; `UserAvatar` on dev renders the deterministic animal (`generateAvatarForUser`) inside a white ring.
- **Superseded while this PR was open.** PR #1307 (issue #1192, "client profile design") landed on `dev` on 2026-09-06 and rebuilt this view: it renders `AnimalAvatar` with `generateAvatarForUser(askerMatrixUserId || user.username || 'unknown')` — the same derivation this branch had implemented — at a responsive 100/64px, inside a `role="img"` span carrying `profile.data.profileIcon` as the accessible name, plus a new footer and action context. Dev's version is the better one (responsive size, explicit ARIA), so this branch **took dev's implementation wholesale** and dropped its own.
- **Deliverable now:** the regression test #1307 did not add. `AskerInfo.test.tsx` guards that the profile renders the animal, keys it on `askerMatrixUserId` with a username fallback, exposes an accessible name, and keeps the remaining person glyph decorative (`aria-hidden`) in the header pill.
