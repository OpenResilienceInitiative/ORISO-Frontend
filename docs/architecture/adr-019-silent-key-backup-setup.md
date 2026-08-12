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

Silent bootstrap is deliberately restricted to `!serverBackupExists &&
!secretStorageReady` (`canBootstrapSilently`). Bootstrapping replaces secret
storage and creates a new backup version; doing that unattended on an account
that already has a backup would orphan history the user could still have
recovered with their existing key. Those accounts keep the explicit,
user-triggered path in the Sicherheit panel.

A per-user lock in `localStorage` (2-minute TTL) keeps two tabs from
bootstrapping concurrently and creating rival recovery keys.

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
