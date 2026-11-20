# #1917 Password envelope after a change without one

Source: Storybook `Organisms/EncryptionSettingsPanel` > `PasswordRecoveryNotEnrolled` and
`Organisms/PasswordEnvelopeStep` (fake Matrix client, synthetic key, no backend).

| Image                                                 | Proves                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-before-settings-not-enrolled-desktop.png`         | Before: recovery works but no password envelope exists and no key is parked on the device. Settings show a status line and "Abmelden und erneut anmelden" only, so the envelope cannot be set up here. Captured with the previous `index.tsx` restored locally, same story. |
| `02-after-settings-not-enrolled-desktop.png`          | After: "Passwort-Wiederherstellung nicht eingerichtet" plus the enrolment form, which takes the existing recovery key (Ersatzschlüssel), the current password and the one-time code.                                                                                        |
| `03-after-password-change-followup-desktop.png`       | After: the step shown right after a password change that left no envelope. Recovery key entered, "Mit neuem Passwort schützen" enabled, "Später" available.                                                                                                                 |
| `04-after-password-change-followup-error-desktop.png` | After: a key that does not match. The step stays open and says why.                                                                                                                                                                                                         |

Not shown by screenshots, covered by tests instead: the step only appears after a change without
any envelope (`PasswordReset.test.tsx`); a key parked on the device is sealed without asking; the
key is sealed under the NEW password (`PasswordReset.test.tsx`, and end to end with the SDK in
`matrixPasswordRecoveryService.test.ts`); a partial envelope still blocks the change.
