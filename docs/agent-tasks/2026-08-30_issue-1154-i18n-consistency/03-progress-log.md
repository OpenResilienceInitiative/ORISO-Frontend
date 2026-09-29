# Progress log — #1154

### Iteration 0 — setup

- Target: intake + spike + plan; branch `cursor/1154/calls-forms-i18n` from `cursor/1154/remaining-chrome-i18n` (clean, matches origin).
- Change: task docs only.
- Verify: n/a

### Iteration 1–5 — implement 13+14+rescan extras

- Target: keys-only `t()` for call widgets, form/modal defaults, composer toolbar, and rescan extras (NotFound, Cal loading, image alt, Header logo, typing aria, booking/drafts iframe titles).
- Change: production components + `calls.*` / `form.*` (+ related keys) in de/en/fr/ru/ti/tr. Shared `callMediaErrorMessage` for SessionMenu / GroupChatHeader.
- Verify: slice scan 28 PASS after comment-strip; `i18n.test.ts` 31 PASS.

### Iteration 6 — test + tsc leftovers that blocked gates

- Target: `test:unit` and `lint:scripts` green on this branch.
- Change: ConsultantSpokenLanguages asserts `form.select.search`; ConversationPreview mock is `t: (key) => key`; AgencyDetailsPanel `t(key)` only; DraftsCenter `query.set('embeddedNotifications', '1')` (consumer already checks `=== '1'`).
- Verify: targeted 74 PASS; `npm run test:unit` 3735 PASS; `npm run lint:scripts` PASS. Local only.

### Iteration 7 — docs / PR-ready

- Target: mark plan + evidence; stop for commit/PR ask.
- Change: `02` / `03` / `04` / `.learnings/STATE.md`.
- Verify: no further code. Waiting: commit + stacked PR on #1242. Do not merge or close #1154.

## Audit 2026-08-31

Independent walk of production `src/**/*.{ts,tsx}` (898 files). Excluded: `*.test.*`, `*.stories.*`, `__tests__`, `src/resources/i18n/**`, DevToolbar, themeDemo, emails/preview, `*.OLD.tsx`, `*.PROFESSIONAL.tsx`. Comments stripped. Plan “full-platform rescan clean” treated as a hypothesis.

### Bucket A — `t`/`tr`/`translate` string fallback / prose `defaultValue`

Literal `t(key, '…')` / `{ defaultValue: 'prose' }`: **zero hits**.

Positional second-arg **variable** still snapping to English:

- `src/components/session/SessionItemComponent.tsx:3914` `translate(\`session.waitingMiniGame.presets.${preset.id}\`, preset.label)`—`'first time'`/`'mild experience (recommended)'`/`'long (experts)'`
- `src/components/session/SessionItemComponent.tsx:3800` `translate(\`session.waitingMiniGame.phase.${phase}\`, phase.charAt(0)…)`—`'Inhale'`/`'Hold'`/`'Exhale'`

### Bucket B — raw user-visible DE/EN chrome

- `src/components/app/NavigationBar.tsx:840` `aria-label={\`${count} unread\`}`
- `src/components/session/SessionItemComponent.tsx:195-203` preset `label` English (rendered via fallback above)
- `src/components/session/SessionItemComponent.tsx:206-257` `BREATH_LEVELS` English `title`/`success` (badge, achievement interpolation, `setStageMessage`)
- `src/components/session/SessionItemComponent.tsx:259-283` `BRIEFING_SCREENS` English `text` (overwritten at render; still one-language source)
- `src/components/session/SessionItemComponent.tsx:500` `'Let us get you grounded with one easy round.'`
- `src/components/session/SessionItemComponent.tsx:1689` `'Last reply at '` (passed into `threadSummary.lastReplyText`)
- `src/components/session/SessionItemComponent.tsx:2331` `` `Congratulations, you made it. …` ``
- `src/components/session/SessionItemComponent.tsx:2731` `'New reply in thread'`
- `src/components/session/SessionItemComponent.tsx:3560` `Level {currentLevel}:` + English title
- `src/components/session/SessionItemComponent.tsx:3818` `>4s<`
- `src/components/session/SessionItemComponent.tsx:3872` ``aria-label={\`${label} seconds\`}``
- `src/components/messageSubmitInterface/MessageSubmitErrorBoundary.tsx:64-71` `Der Chat-Eingabebereich konnte nicht geladen werden.` / `label: 'Erneut versuchen'`

### Bucket C — allowed / out of scope (not fixed)

- API `agency.name` / `topic.name`; ConsultingTypeService `option.label`
- Ukrainian UI (no `uk` locale)
- Language picker Deutsch/English; brand BETA; Element Call / WebRTC / LiveKit
- `*.OLD.tsx` / `*.PROFESSIONAL.tsx` (not production imports)
- Comments, testids, CSS class names, key-looking strings (`topic-selection`, `overview.upcomingAppointments`)
- `erstantwortCatalogue.ts` German `defaultBody` — not passed to `t()`; resolve uses `translate(key)` only
- `utils/anonName/data.ts` locale name pools
- `emails/content/*` per-locale email catalogues

### Iteration 8 — fail

- Target: close Bucket A/B hits from this audit.
- Hypothesis: slices 13–15 only covered `callsFormsI18n` SLICE_FILES; mini-game fallbacks and nav/composer chrome were outside that list.
- Change: extend `callsFormsI18n.test.ts` regexes first (red), then keys-only `t()` + catalogues.
- Verify: 3 FAIL (SessionItemComponent, MessageSubmitErrorBoundary, missing rescan keys).

### Iteration 9 — pass

- Target: same Bucket A/B hits.
- Change: NavigationBar unread aria; SessionItemComponent mini-game/thread chrome; MessageSubmitErrorBoundary; keys in de/en/fr/ru/ti/tr. Extended `callsFormsI18n` SLICE_FILES + regexes.
- Verify: slice 31 PASS; remainingChrome 23; anonymousChatMinigame 5; i18n 31; `npm run test:unit` 3738 PASS; `lint:scripts` pending then PASS. Post-fix walk of the same 898 files: zero remaining A/B hits.
