## Verified facts

- Consultant Live Chat in `NavigationBar` was gated with `fromL` (900px+) and CSS `display: none` below `$fromLarge`, which hid it on mobile/tablet.
- Language switcher used the same desktop-only CSS hide under `.app__wrapper` figma nav rules.
- Outgoing `CallManager.startCall` always sets `usesElementCall: true`. SessionMenu 1:1 used to keep `window.__preRequestedMediaStream` for FloatingCallWidget, which skips Element Call — tracks stayed `live` until explicitly stopped.

- The repo requires Node **22.12.0** (`.nvmrc` + `package.json` engines `>=22 <23`); `AGENTS.md` still says CI Node 18, which is stale. Homebrew's node shadows nvm on `PATH`, so `nvm use` alone is not enough — prepend `~/.nvm/versions/node/v22.12.0/bin`.
- `npm run build` sets no `NODE_OPTIONS` (unlike `test:unit`) and OOMs locally; it needs `--max-old-space-size=8192`. Its `postbuild` host validator also trips on a local `.env` with `REACT_APP_KEYCLOAK_REALM=online-beratung`, which CRA inlines into the bundle.
- `lint:style` is red on `pre-dev` with 18 pre-existing errors in 5 SCSS files (legalLinkModal, profile, PseudonymCard, stage, StageLayout).
- `SessionListItemComponent` has two early returns: no `consultingType` (~line 607) and `activeSession.isGroup` (~line 863). The group branch renders a separate card, so anything added to the main return is dead code for group chats.
- `SessionListItemComponent` _is_ mountable in jsdom — see `SessionListItemComponent.test.tsx`. It needs real context providers (`UserData`, `SessionType`, `ActiveSession`, `SessionsData`, `E2EE`, `LegalLinks`) plus mocks for `useConsultingType`, `useE2EE`, `useMatrixSessionPreview`, `useUnreadVersion`, `useActiveListItem`, lottie, and the SVG/asset imports.
- On a group row only `showChatSettings` can be true: `isOwnEditableSession` requires `isSession` (false for group chats) and `isTeamDiscussionAvailable` returns false when `isGroup`. This is load-bearing, not incidental: `Overlay`, `LegalLinkModal` and `DeleteSession` all render in the main return (~`:1481-1497`), after the group branch has returned. `handleDeleteSession` calls `openDeleteConfirmRef.current?.()` and that ref is only set by `<DeleteSession>`, so an archive/delete entry appearing on a group row would be a _silent_ no-op.

## General rules

- Figma consultant mobile bottom bar should scroll the full row (routes + Live Chat + language + logout), not pin logout alone while hiding actions.
- Changing a multi-line JSX condition to a single line re-indents the whole guarded block, so Prettier rewrites hundreds of untouched lines. When editing a gate above a large JSX tree, keep the original line-break shape (`{a &&\n\t(b || c) && (`) and express the new logic within it.
- Session-list row menu and session header menu must stay in lockstep: put the decision in `chatroomSettingsMenu.ts` (pure, unit-tested). But a green pure-helper suite is **not** evidence for an acceptance criterion phrased as "the user sees X" — that needs a test that mounts the component. Claiming otherwise once shipped a no-op.
- Before adding UI to a large component, locate every `return` above the insertion point. A guarded early return silently makes the new markup unreachable for exactly the case the ticket is about, and a helper-level test cannot detect it.
- When a fix relies on removing a bug, prove the new test fails with the bug reintroduced (revert the wiring, run, restore). Absence-assertions like "non-owner sees no menu" pass trivially on broken code, so only the presence-assertions actually guard anything.
- After parent-page `getUserMedia` warm-up for Element Call, stop tracks immediately; iframe acquires its own media. Also clear `__preRequestedMediaStream` in `endCall`/`rejectCall`.

## Open failures

- Predev headless call loop for `nikunjcouncellor1` blocked: 2FA setup keeps navigation on `/profile/einstellungen/sicherheit`.

## Lessons learned

- “Pinned logout + scroll routes” on mobile made Live Chat/language unreachable once they were added to the bottom group; prefer one scroll container for the whole bar on small screens.
- Dual call stacks (Element Call vs native) make warm-up stream ownership easy to get wrong when one path is retired but the store/release still assumes the other.
- #1189: the `verifier` subagent reported "acceptance criteria 1 and 3 have no executable coverage" and the branch was pushed anyway, on the strength of reading the condition instead of rendering it. The `qa` subagent then found the defect within minutes of actually mounting a group row. When a reviewer names a missing class of evidence, produce that evidence — do not substitute reasoning for it.

## Last session

- 2026-08-27: #1189 follow-up — first Job 2 commit was a no-op (menu in the main return; group rows early-return). Fixed by extracting `SessionListItemMenu`, wiring it into both branches, and adding render-level tests. Red proven by emptying the group cell: tests 1–2 fail, 3–4 stay green. Verifier's remaining robustness nit recorded in code: Overlay/LegalLinkModal/DeleteSession live only in the main return, so widening group-row flags without moving those would be a silent no-op. PR #1205 ready for review against `pre-dev` (local only). Gate: `test:unit` 3462 PASS, `lint:scripts` PASS, `build` PASS, `lint:style` FAIL on pre-existing SCSS only.
- 2026-08-26: #1189 — Job 1 (Create Chat hidden on dev) confirmed as a tenant-seed config issue outside this repo (ORISO-Helm#326), no frontend change; evidence commented on the issue. Job 2 implemented: `showChatSettings` in `chatroomSettingsMenu.ts` plus the list-row menu entry mirroring `SessionMenu`. Gate: `test:unit` 3449 PASS, `lint:scripts` PASS, `build` PASS, `lint:style` FAIL on pre-existing SCSS only. Next step: reviewer verification on an environment where the tenant flag is enabled.
- 2026-08-02: Camera activation bug — fixed orphaned `__preRequestedMediaStream` on Element Call path (`callMediaStreamCleanup` + SessionMenu/CallManager/widgets). Local leak repro PASS; full predev E2E blocked by 2FA.
