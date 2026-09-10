# ADR-019: Set the key backup up silently and park its recovery key

- Status: Proposed
- Date: 2026-08-12
- Owners: ORISO Frontend
- Decision scope: ORISO-Frontend

## Context

Fixing [#839] gave every login a crypto probe: if the account had no key
backup, a modal ("Ihre Nachrichten sicher aufbewahren") opened as soon as the
Matrix sync reached `PREPARED`. For a freshly registered asker that is the
first thing the product says to them — over their Anfrage, before they have
written a single message, about a Tresor they have no reason to care about yet.

The dialog also cannot achieve much. Its primary action is a link into
Profil → Einstellungen → Sicherheit; the user has to leave what they were
doing, and the dismissal ("Später") is session-scoped, so it comes back. The
only outcomes are an interruption or an interruption plus a detour.

Meanwhile the reason the dialog exists is real: without a server-side key
backup, a user who logs in on a new device loses their case history silently.
That is [#839] and it must stay fixed.

Two things are conflated in the current flow: **creating** the backup (a purely
technical step, needs no decision from the user) and **saving the recovery
key** (needs the user, but not right now).

## Decision

Split them.

1. **Create the backup silently.** When the login-time probe finds a fresh
   identity, the app bootstraps cross-signing, secret storage and key backup in
   the background. No dialog, no navigation, no interruption.
2. **Park the generated recovery key** per user in `localStorage` and surface
   it in the Sicherheit panel, which shows it with copy button and the existing
   "Ich habe den Schlüssel sicher gespeichert" confirmation. Confirming deletes
   the parked copy.
3. **Keep asking on a new device.** When the server holds a backup this device
   cannot read (`keyStorageOutOfSync`), only the user can unlock it, so the
   recovery dialog stays exactly as it is. That dialog now has a single mode.

Its session-scoped dismissal is bound to the user who dismissed it, and it
silences nothing but the dialog: a different account logging into the same tab
still gets its own answer, and the background bootstrap always runs when it is
eligible — nobody dismissed *that*.

Silent bootstrap is deliberately restricted to `!serverBackupExists &&
!secretStorageReady` (`canBootstrapSilently`). Bootstrapping replaces secret
storage and creates a new backup version; doing that unattended on an account
that already has a backup would orphan history the user could still have
recovered with their existing key. Those accounts keep the explicit,
user-triggered path in the Sicherheit panel.

A per-user, owner-bound lock in `localStorage` keeps two tabs from
bootstrapping concurrently and creating rival recovery keys. The owner holds it
for the whole `setUpRecovery` call and keeps it alive by heartbeat, so a slow
setup never loses it; only the owner can release it, so a superseded tab
finishing late cannot free somebody else's lock. The 60-second TTL therefore
only ever expires for a tab that is actually gone. The manual setup in the
Sicherheit panel takes the same lock and reports a busy state rather than
starting a rival bootstrap.

## Consequences

**Good**

- Nothing interrupts registration or the Anfrage. The backup exists anyway.
- The backup is created at the one moment it reliably can be: right after a
  password login, while the device-signing UIA callback is still registered.
  A user who clicked "Später" previously ended up with *no* backup at all.
- The recovery key survives a reload before the user has written it down —
  today the manual flow shows it once and loses it if the tab closes.

**Bad, and accepted**

- The recovery key sits in `localStorage` until confirmed. It lives next to the
  Rust crypto store, which already holds this device's Megolm keys, so an
  attacker with local access gains little — but an XSS that reaches the parked
  key gains durable access to *future* history too, which the crypto store
  alone would not give. The window is bounded by the user's confirmation, and
  the key is per user and never sent anywhere.
- A user who never opens Sicherheit never learns their recovery key. They are
  still better off than today (a backup exists, and the key is retrievable from
  this device), but on a lost device their history is gone. A gentler,
  non-modal nudge at a better moment — after the first reply, say — is the
  obvious follow-up and is deliberately not part of this decision.
- Accounts with a broken-but-existing backup no longer get any prompt at login.
  They are surfaced in the Sicherheit panel only.
- If the silent bootstrap fails (for example the device-signing UIA is
  unavailable after a token-refresh reload), the app stays quiet by design.
  The user is not told, because they did not ask; the Sicherheit panel still
  reports the state and offers the manual setup.

## Alternatives considered

- **Delay the dialog** (first reply, second session): still an interruption,
  just later, and still dismissible into a state with no backup.
- **Derive the recovery key from the login password**: no key to park, and
  recovery on a new device would need nothing but the password. Rejected for
  now — the password is not available on every path that would need to re-key
  (token-refresh reloads, OTP flows), and a password change would silently
  invalidate recovery.
- **Show the key once, in memory, and never park it**: leaves a backup nobody
  can restore — worse than the current state, because it looks safe.

[#839]: https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/839

## Password recovery extension (2026-09-10)

Authenticated `userData.chatRecoveryMode` and `chatRecoveryPolicyRevision` are
immutable account-creation snapshots. Missing/null mode means `RECOVERY_KEY`;
current platform defaults never migrate existing identities. Anonymous identities
are excluded. `LOGIN_PASSWORD` adds a native SDK Secret Storage envelope
`org.oriso.password_recovery.v1` around the **same random encoded recovery key**.
The wrapping key is never made the default root; backup version and cross-signing
identity remain unchanged. Saving an optional recovery code does not remove the
password envelope or change the account mode.

The complete Keycloak login (including required OTP) and Matrix login stage a
one-use, identity-bound memory handoff with a 120-second maximum lifetime. Only
the authenticated application's sole PREPARED Matrix client consumes it. Reloads
without credentials use device keys and offer explicit recovery/reauthentication;
no password is serialized. Temporary SDK callback keys are scoped to each client
and validated against each requested key description. Logout/client teardown
clears these scopes.

A password change writes and verifies a separate native-SDK encrypted candidate
`org.oriso.password_recovery_candidate.v1.<passwordKeyId>` before calling the
account password API. Each immutable ciphertext holds the same root payload,
policy revision, observed predecessor candidate IDs and a legacy-envelope
retirement flag. These additional fields are inside the encrypted payload.
The original shared envelope is never rewritten by candidate activation.

This corrects the original two-wrappers-in-one-secret plan: Matrix account data
has no compare-and-swap, and a rejected change on another device could overwrite
the only wrapper for a password already accepted by the login server. Candidate
inventory comes from a separate, bounded `/sync` request with no `since`, no rooms
and an account-data type filter. Its `next_batch` is never acknowledged or reused
by the main client. Candidate decryption uses the native Secret Storage SDK with
a fresh HTTP read adapter, so cached PREPARED state cannot hide a committed
candidate. Invalid or failed inventory is a retryable error, never a fresh user.

On definite password rejection only that attempt's own candidate is tombstoned.
An uncertain response preserves it. Successful change or subsequent authenticated
login retires only predecessors explicitly observed and decrypted with the prior
password, including their recorded ancestors. A delayed success cannot recreate
an older shared wrapper or delete an unknown concurrent candidate. Public,
unreferenced wrapping-key descriptions may remain; retired candidate ciphertext
is removed. Candidates with unknown credential outcomes remain available until
they can be safely reconciled. A bounded inventory limit fails safely instead of
silently discarding candidates.

Forgotten-password recovery requires the existing recovery code. Explicit
re-enrollment verifies the current password and required OTP online. If any
existing candidate cannot be opened with that password, its outcome cannot be
safely classified: re-enrollment is blocked before any new candidate is written.
Key-based history restoration remains available and the UI explains this limit.
The app does not claim that older copied encrypted data has been revoked.

Recovery no longer calls `bootstrapCrossSigning`, because the SDK may generate a
new identity when even one stored private cross-signing secret is missing.
Instead it reads all three existing secrets with the server-backed SDK adapter,
queries the published public keys, imports the existing SDK secrets bundle, and
compares all imported/public signing IDs again before signing the device. Missing
or mismatched identity material fails without publishing a replacement identity.

Background setup rechecks the server root, backup and password-envelope evidence
inside the setup lock. Web Locks provide same-browser serialization where
available, with the existing localStorage lease fallback. Account-data writes
have no distributed compare-and-swap: fingerprint checks detect observed remote
identity changes but cannot promise cross-device transactions. Unknown metadata,
network failures or an interrupted envelope are never fresh-identity signals.

Enquiry finalization now marks a user-scoped optional, nonmodal key-save invitation.
Matrix-send-only success does not qualify. The invitation distinguishes pending
backup from a usable parked recovery key and survives navigation. “Later” keeps
the key in settings; explicit confirmation clears it. Manual recovery is reachable
inline and from security settings without interrupting enquiry composition.

The original alternative rejecting a password-derived **root** still stands.
The extra envelope resolves password-lifecycle handling without replacing that
root. OTP protects online access; stolen password-encrypted backup data remains
subject to offline password guessing. Rewrapping cannot revoke copied old data.

Validation boundary: native-SDK envelope tests use real derivation/encryption and
independent Secret Storage instances with in-memory account-data transport and
controlled backup API fixtures. They do not prove server-side Megolm history
restoration, deployed login/OTP behavior, or fresh-browser acceptance.
