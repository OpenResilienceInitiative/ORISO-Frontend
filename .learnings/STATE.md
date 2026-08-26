## Verified facts

- Consultant Live Chat in `NavigationBar` was gated with `fromL` (900px+) and CSS `display: none` below `$fromLarge`, which hid it on mobile/tablet.
- Language switcher used the same desktop-only CSS hide under `.app__wrapper` figma nav rules.
- Outgoing `CallManager.startCall` always sets `usesElementCall: true`. SessionMenu 1:1 used to keep `window.__preRequestedMediaStream` for FloatingCallWidget, which skips Element Call — tracks stayed `live` until explicitly stopped.

- The repo requires Node **22.12.0** (`.nvmrc` + `package.json` engines `>=22 <23`); `AGENTS.md` still says CI Node 18, which is stale. Homebrew's node shadows nvm on `PATH`, so `nvm use` alone is not enough — prepend `~/.nvm/versions/node/v22.12.0/bin`.
- `npm run build` sets no `NODE_OPTIONS` (unlike `test:unit`) and OOMs locally; it needs `--max-old-space-size=8192`. Its `postbuild` host validator also trips on a local `.env` with `REACT_APP_KEYCLOAK_REALM=online-beratung`, which CRA inlines into the bundle.
- `lint:style` is red on `pre-dev` with 18 pre-existing errors in 5 SCSS files (legalLinkModal, profile, PseudonymCard, stage, StageLayout).

## General rules

- Figma consultant mobile bottom bar should scroll the full row (routes + Live Chat + language + logout), not pin logout alone while hiding actions.
- Changing a multi-line JSX condition to a single line re-indents the whole guarded block, so Prettier rewrites hundreds of untouched lines. When editing a gate above a large JSX tree, keep the original line-break shape (`{a &&\n\t(b || c) && (`) and express the new logic within it.
- Session-list row menu and session header menu must stay in lockstep: put the decision in `chatroomSettingsMenu.ts` (pure, unit-tested) rather than in `SessionListItemComponent`, which has no test file because of its context load.
- After parent-page `getUserMedia` warm-up for Element Call, stop tracks immediately; iframe acquires its own media. Also clear `__preRequestedMediaStream` in `endCall`/`rejectCall`.

## Open failures

- Predev headless call loop for `nikunjcouncellor1` blocked: 2FA setup keeps navigation on `/profile/einstellungen/sicherheit`.

## Lessons learned

- “Pinned logout + scroll routes” on mobile made Live Chat/language unreachable once they were added to the bottom group; prefer one scroll container for the whole bar on small screens.
- Dual call stacks (Element Call vs native) make warm-up stream ownership easy to get wrong when one path is retired but the store/release still assumes the other.

## Last session

- 2026-08-26: #1189 — Job 1 (Create Chat hidden on dev) confirmed as a tenant-seed config issue outside this repo (ORISO-Helm#326), no frontend change; evidence commented on the issue. Job 2 implemented: `showChatSettings` in `chatroomSettingsMenu.ts` plus the list-row menu entry mirroring `SessionMenu`. Gate: `test:unit` 3449 PASS, `lint:scripts` PASS, `build` PASS, `lint:style` FAIL on pre-existing SCSS only. Next step: reviewer verification on an environment where the tenant flag is enabled.
- 2026-08-02: Camera activation bug — fixed orphaned `__preRequestedMediaStream` on Element Call path (`callMediaStreamCleanup` + SessionMenu/CallManager/widgets). Local leak repro PASS; full predev E2E blocked by 2FA.
