# Touched-scope security audit

Local source review, 2026-10-09. Scope: practice End action and versioned progress writes.

## Outcome

No unresolved security findings in the touched scope.

- Cancellation sends only the existing frontend tutorial-progress payload: known tour ID/version and `not_started`, without step ID, fictional case content, messages, drafts or counsellor text.
- Existing whitelist and drained sandbox exit remain intact. The End action takes a hold before clearing the host; both fulfilled and rejected reset promises release it. Existing two-second drain timeout bounds cleanup if a request hangs.
- Practice writes are ordered per authenticated identity and tour/version, preventing an older in-progress response from overwriting cancellation.
- Delayed writes compare token subject, issuer and tenant immediately before dispatch and reject after a different login. Same-subject token refresh keeps its scope. Tokens are neither persisted nor logged.
- Completed/skipped and ordinary tour writes retain their existing semantics; only practice writes enter the queue.
- A cancellation settling later does not call exit again, so it cannot close a newer run. A dedicated regression covers this.
- No new browser storage writes, Matrix writes, permissions or backend endpoints were introduced.

## Evidence / limits

Repository tests cover delayed progress ordering, prior-write failure and login changes. Banner tests cover rejected reset cleanup and cancellation settling after a new run. Real-shell integration covers returning to Help, the final `not_started` write, guard cleanup and no real Matrix writes.

Verification is local only. The existing network drain timeout remains unchanged; on a hung request the UI can exit before the reset settles. A rejected reset is handled so cleanup succeeds; this change does not claim a successful server reset on rejection. Backend clearing of an omitted currentStepId is not established by these frontend tests.
