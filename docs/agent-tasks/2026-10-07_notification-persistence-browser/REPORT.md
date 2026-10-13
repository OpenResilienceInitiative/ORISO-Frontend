# Local browser verification — notification persistence

The actual NotificationsProvider and NotificationsCenter preserve unread state when a read, read-all or clear request is pending or rejected. Successful operations survive a real page reload from the controlled API state. The baseline falsely cleared unread state on a rejected card read; the repaired candidate retains it.

**This is a local synthetic fixture.** It does not verify Dev deployment, real login, Matrix authorization, delivered mail, sound, native banners, closed-tab Web Push or the full accepted notification matrix.

The independent Chromium run at commit `4e9b8d98e103ad1fc5d600d9d3835310946b9b27` passed **30/30 assertions**, recorded **20 scenarios**, captured **15 PNG screenshots** and **4 Playwright traces**, with **0 page errors**. React StrictMode was enabled. Both reviewed security/correctness cases now pass: direct account replacement cannot be cleared by the former account's delayed acknowledgement, and an individual read remains effective while read-all or clear fails. Same-principal/session JWT refresh preserves a pending read. A stale GET cannot restore an acknowledged clear. The later PR review identified deferred hidden-read wake-up and mutation-feedback gaps; their correction and new-candidate validation are tracked in PR1667. This report preserves the earlier candidate evidence.

**For developers — source and runtime identity:**

```text
Base commit: b527b8bc6fea723b2ca59ec73f57127debb022f9
Repaired provider working-tree SHA256:
23e7c8da66eb9f94c1b0f2673e5a351f6781aa00d20e81940e25f3d06d1c8117
Runtime: installed Node22.12.0, Playwright Chromium, isolated contexts
Viewports: desktop1440x900, tablet820x1180, mobile390x844
Locales: actual DE and EN resource catalogues
Components: actual NotificationsProvider + NotificationsCenter + product styles
HTTP: actual notification API functions, intercepted synthetic stateful route
Events: synthetic request.new / conversation.finished; no Matrix room content
Before fixture: exact base provider substituted by a test-only Vite load hook
After fixture: actual frozen working-tree provider
```

The twelve viewport/locale screenshots show the same rejected card read before and after. On desktop the center also attempts to read its initial selection, exposing the same baseline defect. The yellow header identifies synthetic controls and current provider state. Actual card clicks and the localized toolbar exercise product UI; clearing uses the labeled fixture control because this bounded center surface exposes no clear action. This standalone shell does not certify full-app responsive layout or accessibility.

- [Structured results](https://evidence.dreambau.com/e/5sryt7pj75cwczusjke4uvmbaiqf7zw6/46ba9cd3-f588-4f50-812a-6baaaa600a33/RESULTS.json) contain every assertion, state, request method/path and synthetic principal.
- [Before desktop DE](https://evidence.dreambau.com/e/5sryt7pj75cwczusjke4uvmbaiqf7zw6/7078ad10-774d-4dcc-b5ae-080ed3ba7456/base-desktop-de-rejected-read.png) versus [after desktop DE](https://evidence.dreambau.com/e/5sryt7pj75cwczusjke4uvmbaiqf7zw6/970e984f-b3eb-4076-89d5-b87717a941a0/after-desktop-de-rejected-read.png).
- [After mobile EN](https://evidence.dreambau.com/e/5sryt7pj75cwczusjke4uvmbaiqf7zw6/d8c0815d-e586-4a71-b5d3-1b2ba291643e/after-mobile-en-rejected-read.png) and remaining viewport pairs are in the [published evidence comment](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1667#issuecomment-6046596199).
- Traces remain local and are not repository links or public artifacts: they contain synthetic session data. The reusable runner produces them for local diagnosis.
- [Reusable runner/config](../../../playwright/notification-persistence-1665/README.md).

Initial bootstrap smoke artifacts are retained separately under initial-bootstrap-debug and excluded from the final results. All task-created browser contexts and the browser were closed; the two task-owned Vite listeners are stopped on release. No application source, production configuration, dependency, GitHub record or external environment was changed by this verifier. The implementation worker owns source changes; the lead owns commit, PR and deployment gates.
