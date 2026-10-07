# Local browser verification — notification persistence

The actual NotificationsProvider and NotificationsCenter preserve unread state when a read, read-all or clear request is pending or rejected. Successful operations survive a real page reload from the controlled API state. The baseline falsely cleared unread state on a rejected card read; the repaired candidate retains it.

**This is a local synthetic fixture.** It does not verify Dev deployment, real login, Matrix authorization, delivered mail, sound, native banners, closed-tab Web Push or the full accepted notification matrix.

The final independent Chromium run passed **30/30 assertions**, recorded **20 scenarios**, captured **15 PNG screenshots** and **4 Playwright traces**, with **0 page errors**. React StrictMode was enabled. Both reviewed security/correctness cases now pass: direct account replacement cannot be cleared by the former account's delayed acknowledgement, and an individual read remains effective while read-all or clear fails. Same-principal/session JWT refresh preserves a pending read. A stale GET cannot restore an acknowledged clear. No further actionable finding was identified in the touched diff.

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

- [Structured results](RESULTS.json) contain every assertion, state, request method/path and synthetic principal.
- [Before desktop DE](base-desktop-de-rejected-read.png) versus [after desktop DE](after-desktop-de-rejected-read.png).
- [After mobile EN](after-mobile-en-rejected-read.png) and all remaining viewport pairs are alongside this report.
- Traces: trace-read.zip, trace-read-all.zip, trace-clear.zip, trace-principal-replacement.zip.
- Reusable runner/config: playwright/notification-persistence-1665/README.md.

Initial bootstrap smoke artifacts are retained separately under initial-bootstrap-debug and excluded from the final results. All task-created browser contexts and the browser were closed; the two task-owned Vite listeners are stopped on release. No application source, production configuration, dependency, GitHub record or external environment was changed by this verifier. The implementation worker owns source changes; the lead owns commit, PR and deployment gates.
