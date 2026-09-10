# Playwright smoke checks

## Deployed registration demo baseline

Run the demo baseline check against a deployed app URL:

```sh
PLAYWRIGHT_BASE_URL=https://app.oriso.org npm run test:smoke:baseline
```

The check derives the API origin from the app origin by replacing `app.` with
`api.`. Override it for non-standard environments:

```sh
PLAYWRIGHT_BASE_URL=https://app.oriso.org \
PLAYWRIGHT_API_BASE_URL=https://api.oriso.org \
npm run test:smoke:baseline
```

It verifies the standard demo registration path for postcode `88885`,
consulting type `1`, and topics `10` (`Eltern und Familie`) and `2`
(`Kinder und Jugendliche`). Failures distinguish API errors, empty agency
responses, wrong UI-selected topic ids, and missing rendered agency cards.

## Password recovery acceptance (deployed environment only)

`playwright.recovery.config.ts` runs one worker, no retries, Chromium and WebKit.
It does not start a local server, provision accounts, seed browser storage, disable
2FA, or inject recovery keys. Trace, video and automatic failure screenshots are
disabled. `PLAYWRIGHT_NO_COPY_PROMPT=1` suppresses automatic failure DOM
snapshot generation in the installed Playwright test runtime (1.58.2,
`lib/index.js::_takePageSnapshot`). The separately installed 1.62.1 runtime has
the same guard. Recheck this internal switch when upgrading Playwright; do not
add ARIA-snapshot assertions to secret-bearing flows. This prevents DOM capture,
not every possible error report or explicit attachment. Every test-owned context uses German locale (`de-DE`) to match
the German UI selectors. Only deliberately masked post-login screenshots are attached, at
390×844, 820×1180 and 1440×900. Do not enable tracing, `DEBUG=pw:api`, or a reporter
that records Playwright call parameters for these credential flows.

Before execution, follow the current ORISO E2E and Test Access skills. Record the
deployed images, approved environment and enrolled account creation policies in
the evidence ledger. Provision dedicated Springfield accounts through the real
supported UI and sync their stable Test Access records. Both roles must have
mandatory OTP, `LOGIN_PASSWORD` enrolled, and access to the same accepted test
conversation. They must not be signed in elsewhere. Actors may be reused across
sequential engines only after every context from the previous engine is closed.
The harness uses distinct message stamps and one worker. Separate actor pairs
are required if engine runs overlap; another live client could assist recovery.

Required non-secret environment variables:

- `PLAYWRIGHT_BASE_URL`: authorized app URL.
- `ORISO_ADMIN_BASE_URL`: authorized Admin URL ending in `/admin`.
- `ORISO_RECOVERY_ADMIN_RECORD`, `ORISO_RECOVERY_ADMIN_USERNAME`.
- `ORISO_RECOVERY_ALLOW_SETTINGS_ROUNDTRIP`: explicit non-empty operator opt-in.
  The Admin test changes defaults to password/password and password/key, then
  restores the original values in `finally`. Revisions increase legitimately.
  Run in an exclusive test window: concurrent account creation would inherit
  the temporarily selected modes; concurrent Admin edits are not supported.
- For each `{ENGINE}` = `CHROMIUM`, `WEBKIT` and `{ROLE}` = `ASKER`, `CONSULTANT`:
  `ORISO_RECOVERY_{ENGINE}_{ROLE}_RECORD`, `_USERNAME`, `_CONVERSATION_URL`,
  `_SECURITY_URL`. URLs must be verified from the actual role's UI, not guessed.
- Optional: `ORISO_TEST_ACCESS_BIN`, `ORISO_TEST_ACCESS_IDENTITY` (default
  `codex-m4-oriso`), `ORISO_RECOVERY_OUTPUT_DIR` (artifact directory).

The CLI retrieves raw password/OTP output directly into process memory. Never
put these secrets in environment variables, command arguments, fixture files or
reports. A missing fixture input fails with `NOT_RUN`; it does not become a
skipped or passed acceptance test.

```sh
npx playwright test --config playwright.recovery.config.ts --list
# After configuring the non-secret fixture inputs above:
npx playwright test --config playwright.recovery.config.ts
```

The history test sends two new synthetic messages, observes encrypted Matrix
send acknowledgements and matching room/session key-backup PUT acknowledgements,
then closes both
original contexts. Only then is a fresh asker context created. It logs in with
password plus OTP and reads both messages. That context is closed before the
fresh consultant is created and tested. No old test peer can supply keys. A
backup ACK alone is not proof of a drained queue; successful offline history
recovery is the decisive assertion.

The positive tests cover Admin save/reload/server readback and fresh-device history.
They do **not** claim creation-time policy snapshots, initial registration/enquiry
finalization timing, original recovery-key fallback, password change/reset, legacy accounts, all conversation types, or physical
iPhone/iPad acceptance. Those remain explicit separate acceptance cases in the
approved plan and evidence ledger. A green harness is not the whole delivery
gate. Review the masked screenshots before publishing them, restore any borrowed
runtime overrides separately, and repeat against normal Dev after review/deploy.

### Bounded negative login gate

Run this separately from positive history flows, with all other sessions for the
selected accounts closed. It makes one deliberately wrong password attempt on
the asker and one deliberately wrong OTP attempt on the consultant; the initial
correct-password/missing-OTP challenge must keep submission disabled. Do not use
retries or run both engine projects repeatedly against the same identities.

Provide `ORISO_RECOVERY_NEGATIVE_ASKER_RECORD`,
`ORISO_RECOVERY_NEGATIVE_ASKER_USERNAME`,
`ORISO_RECOVERY_NEGATIVE_CONSULTANT_RECORD`, and
`ORISO_RECOVERY_NEGATIVE_CONSULTANT_USERNAME`, plus `PLAYWRIGHT_BASE_URL`.

```sh
npx playwright test --config playwright.recovery.config.ts \
  --project chromium --grep 'negative gate:'
```

The gate requires an actual token rejection (400/401), the unauthenticated form,
no authenticated profile/conversation, and no Matrix sync/key-backup/account-data
startup requests. It captures only masked rejection screenshots. It does not
assert tenant-specific error wording and never resets passwords or bypasses OTP.

Screenshot acceptance checks actual paragraph geometry against the visible chat
viewport, clipped above the composer, and verifies text is not covered by another
element. Bounded positioning waits for three stable applied scroll deltas; native
scroll clamping is allowed only while full visibility still holds. Geometry is
checked again after capture. The combined message bounds are centered when they
fit; otherwise separate asker/consultant screenshots preserve both proofs. Both
messages must still decrypt before capture. No application CSS is modified.

Current validation boundary (2026-09-10): the bounded Chromium negative gate
passed on PreDev. Full peers-offline restoration and visible screenshot gates
passed in WebKit v9 and Chromium v10 with both roles and all three viewport sizes.
The final Chromium correction measures actual applied scroll movement at native
scroll limits; WebKit v9 passed the stronger, unclamped centering criterion.
Representative fresh-client PNGs were visually inspected. Chromium's consultant
desktop capture also showed a backup-warning banner after a responsive reload,
despite restored history; that warning remains a separate reported observation.
These are desktop browser-engine/viewport tests, not physical-device acceptance.
See delivery evidence for exact candidate versions, logs and screenshots.
