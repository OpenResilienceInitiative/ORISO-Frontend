# Local actual-component persistence fixture

This harness renders the real NotificationsProvider and NotificationsCenter, including the existing Notifications alert renderer, real API functions, styles, role contexts and DE/EN translation catalogues. Playwright intercepts the HTTP boundary with a synthetic stateful API. No real login credentials, Matrix rooms, Dev tenants, SMTP or received mail are involved. Synthetic JWTs identify two fixture principals; they are not usable access credentials.

Two task-owned Vite processes use the existing Storybook viteFinal configuration. The baseline process substitutes only the unchanged-base provider module with its exact b527b8bc6fea723b2ca59ec73f57127debb022f9 contents; surrounding component files are from this worktree. The repaired process loads the actual working-tree provider. Yellow fixture controls expose provider operations absent from the center; actual card clicks and the localized Mark all as read toolbar use product components. StrictMode is enabled.

Run from the repository root with the installed Node22 runtime on PATH, in separate terminals:

```sh
FIXTURE_PORT=9017 node node_modules/vite/bin/vite.js --config playwright/notification-persistence-1665/vite.config.mts
FIXTURE_PORT=9018 FIXTURE_BASELINE=1 node node_modules/vite/bin/vite.js --config playwright/notification-persistence-1665/vite.config.mts
node playwright/notification-persistence-1665/verify.mjs
```

The runner launches isolated headless Chromium, closes each context and browser in finally blocks, captures 1440×900 /820×1180 /390×844 viewports in DE and EN, and records controlled pending/rejected/success/reload interactions. Evidence is written under docs/agent-tasks/2026-10-07_notification-persistence-browser. The JSON includes the provider working-tree SHA256 and base commit so evidence is tied to the source actually tested. Repeat only after the candidate is frozen before claiming final candidate coverage. Stop both Vite processes after the task; do not close any pre-existing user browser.

The standalone component shell is a bounded fixture, not full responsive-app integration or Dev acceptance. No banner, sound, OS Web Push, permission or recipient-mail claim follows from these tests.

Review regression coverage supplements the original 30 assertions: pending/disabled/aria-busy state of the real Mark all as read toolbar; actual localized error alerts for card read, read-all and clear in DE/EN; and deferred hidden-read wake after rejected read-all, rejected clear and confirmed clear with an epoch change. The last scenarios attach a synthetic synced Matrix client to the real display-filter store and use an unloaded hidden system row at the intercepted HTTP boundary. No new product control or alert replica is rendered. The runner refuses evidence capture while src contains uncommitted changes.
