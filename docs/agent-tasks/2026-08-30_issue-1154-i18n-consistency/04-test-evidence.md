# Test evidence — #1154 slices 13–15 + 2026-08-31 audit

Verified on 2026-08-31, Node 22.12.0, **local only** (no Pre-Dev deploy).

## Targeted

- `npx vitest run --project unit src/components/call/callsFormsI18n.test.ts` → 31 PASS (was 28; SLICE_FILES + audit regexes)
- `npx vitest run --project unit src/components/session/remainingChromeI18n.test.ts` → 23 PASS
- `npx vitest run --project unit src/components/anonymousChat/anonymousChatMinigameI18n.test.ts` → 5 PASS
- `npx vitest run --project unit src/i18n.test.ts` → 31 PASS

## Broader

- `npx eslint --max-warnings=0` on touched TS/TSX → pass
- `npm run lint:scripts` → pass
- `npm run test:unit` → 368 files / **3738 PASS**
- `npm run lint:style` → not run (no SCSS; already red on pre-dev)
- `npm run build` → not run
- Browser in `fr`/`ru` → NOT RUN

## Red-green

- Independent walk of 898 production files found leftover mini-game `t(key, English)`, nav unread aria, composer error German, and thread/level chrome.
- Extended `callsFormsI18n.test.ts` failed on those files first, then went green after keys-only `t()`.
- Catalogue asserts now also cover `navigation.unreadCount`, `message.submit.loadError`/`retry`, `message.thread.lastReplyAt`, and mini-game seconds/level keys in every UI locale.
