# Recovery fault and identity-isolation browser gates

Run separately from the existing peer-offline history suite. Uses the real PreDev
public signup/profile/enquiry UI and scoped Test Access runtime credentials.
Only deliberate failures are intercepted; no successful response, authentication,
crypto key, IndexedDB or storage state is injected. Traces/video/failure DOM
snapshots are disabled by the inherited recovery configuration. Explicit PNGs
mask input fields and recovery keys. These transient-state gates capture desktop;
the core suite separately covers three widths and both engines.

Required environment:

- `PLAYWRIGHT_BASE_URL` (authorized candidate URL)
- `ORISO_RECOVERY_OUTPUT_DIR` (evidence directory)
- `ORISO_FAULT_{A,B,C}_{RECORD,USERNAME,EMAIL}` (fixed-pool metadata only)
- optional `ORISO_TEST_ACCESS_BIN`, `ORISO_TEST_ACCESS_IDENTITY`
- `ORISO_FAULT_A_EXISTING=1` resumes A through normal password login only when A
  exists but still has an unsubmitted enquiry. Never use this to re-register A.

Fixture requirements are intentionally strict: tenant10, topic Eltern und
Familie, ZIP10965, agency12, expected creation snapshot LOGIN_PASSWORD revision14.
A/B/C are distinct unused managed identities with no initial OTP. B must have no
previous application login: backup interception attaches before public signup.
The helpers immediately sync registration201 to Test Access, then bind the exact
pool email through the real profile and verify its disabled field readback.

```
npx playwright test --config=playwright.recovery-faults.config.ts
```

Each test consumes fresh fixture state. Do not blindly rerun after registration
or finalization has succeeded; inspect the failed phase and reuse only a valid
remaining state, or reserve new identities. No account repair/reset is performed.

Cases:

1. A: one finalization503 after real encrypted send; no sent confirmation/key
   invitation and draft remains. Real retry finalizes201 without duplicate send.
2. C→A: new C enquiry has an actual parked key. Show it masked, normal UI logout,
   normal A password login in the same browser context. No C key/reminder appears;
   A's own password recovery becomes ready. Source key is only compared in memory.
3. B: hold actual first backup-version POST, submit real enquiry201, then release
   backup503. Request remains successful while UI reports incomplete backup and
   offers the settings retry action. This deliberately leaves an incomplete
   backup fixture; it is not a routine demonstration account.

2026-09-10 evidence: isolated C→A gate passed22.7s; B ordered backup-failure gate
passed14.5s. A's failed-finalization assertions and actual retry completed in
faults-v3, but that earlier combined test subsequently failed because it expected
a newly parked key after A had been recovered in a fresh context. The tests were
split to remove that invalid dependency; the corrected standalone A test was
not rerun against its already-finalized enquiry. Preserve this runner-versus-step
boundary rather than reporting three complete green test executions.
