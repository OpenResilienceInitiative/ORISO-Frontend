## Verified facts

- Consultant Live Chat in `NavigationBar` was gated with `fromL` (900px+) and CSS `display: none` below `$fromLarge`, which hid it on mobile/tablet.
- Language switcher used the same desktop-only CSS hide under `.app__wrapper` figma nav rules.
- Outgoing `CallManager.startCall` always sets `usesElementCall: true`. SessionMenu 1:1 used to keep `window.__preRequestedMediaStream` for FloatingCallWidget, which skips Element Call — tracks stayed `live` until explicitly stopped.

## General rules

- Figma consultant mobile bottom bar should scroll the full row (routes + Live Chat + language + logout), not pin logout alone while hiding actions.
- After parent-page `getUserMedia` warm-up for Element Call, stop tracks immediately; iframe acquires its own media. Also clear `__preRequestedMediaStream` in `endCall`/`rejectCall`.

## Open failures

- Predev headless call loop for `nikunjcouncellor1` blocked: 2FA setup keeps navigation on `/profile/einstellungen/sicherheit`.

## Lessons learned

- “Pinned logout + scroll routes” on mobile made Live Chat/language unreachable once they were added to the bottom group; prefer one scroll container for the whole bar on small screens.
- Dual call stacks (Element Call vs native) make warm-up stream ownership easy to get wrong when one path is retired but the store/release still assumes the other.

## Last session

- 2026-08-02: Camera activation bug — fixed orphaned `__preRequestedMediaStream` on Element Call path (`callMediaStreamCleanup` + SessionMenu/CallManager/widgets). Local leak repro PASS; full predev E2E blocked by 2FA.
