# #1931 E2EE: history sealed under a password changed outside the Frontend

Source: Storybook `Organisms/EncryptionSettingsPanel` >
`PasswordRecoveryStaleEnvelope`, `PasswordRecoveryStaleEnvelopePreviousPassword`,
`PasswordRecoveryStaleEnvelopeRecoveryKey`
(`src/components/profile/EncryptionSettings/EncryptionSettings.stories.tsx`). Fake Matrix
client with one password candidate on the server (so an envelope exists), recovery runtime
status `needs-recovery-key` (what a password sign-in reports when the current password opens
none of the copies), LOGIN_PASSWORD mode, 2FA active.

"Before" was captured by running the same stories against the parent commit (panel code
unchanged, only the new story file copied in). Viewport 1024 px, desktop.

| Image                                          | Proves                                                                                                                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-before-same-device-desktop.png`            | Before, device that still holds the history: only the status line and "Abmelden und erneut anmelden". No way to re-seal; signing in again changes nothing.                                                 |
| `02-before-new-device-desktop.png`             | Before, new device: status, logout, and the plain recovery-key input. Restoring with it worked, but re-sealing under the current password then failed (`repairBlocked`) whenever stale candidates existed. |
| `03-after-choice-same-device-desktop.png`      | After: explanation of why the password no longer opens the history, and the two ways back: "Vorheriges Passwort eingeben" / "Ersatzschlüssel eingeben". The logout button is gone.                         |
| `04-after-previous-password-desktop.png`       | After, way 1: previous password, current password and one-time code; "Mit aktuellem Passwort sichern".                                                                                                     |
| `05-after-recovery-key-new-device-desktop.png` | After, way 2 on a new (out-of-sync) device: recovery key, current password, one-time code. The separate recovery-key input below is hidden, so there is one key entry that also re-seals.                  |

Not shown by screenshots, covered by tests instead:

- The re-seal itself and what it leaves on the server (`matrixPasswordRecoveryService.test.ts`,
  "an envelope left sealed under the previous password"): previous password re-wraps legacy and
  candidate envelopes, the current password restores on a new device, the previous one no longer
  does, a later in-app change rotates again; a proven recovery key replaces stale copies; a wrong
  key or a candidate not sealed under its own key still blocks and changes nothing.
- The panel flows (`EncryptionSettings.test.tsx`): re-authentication with password + OTP before
  any re-seal, the error for a wrong previous password, and the `ready` status afterwards.
- The setup-gate hook (`useAuthenticatedChatRecovery.test.tsx`): with only the second factor
  owed, the sign-in password now sets recovery up.
