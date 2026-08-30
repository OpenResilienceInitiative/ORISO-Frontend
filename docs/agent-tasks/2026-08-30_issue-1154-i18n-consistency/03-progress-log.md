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
