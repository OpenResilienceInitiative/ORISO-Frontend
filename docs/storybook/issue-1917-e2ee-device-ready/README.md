# #1917 E2EE settings: "device-ready" status text

Source: Storybook `Organisms/EncryptionSettingsPanel` > `PasswordRecoveryDeviceReady`
(`src/components/profile/EncryptionSettings/EncryptionSettings.stories.tsx`), with a
fake Matrix client and the recovery runtime status set to `device-ready`.

| Image                                        | Proves                                                                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-before-device-ready-raw-key-desktop.png` | Before: the status line shows the raw key `encryption.passwordRecovery.deviceReady`. Captured by re-applying the old one-line `device-ready` -> `deviceReady` mapping locally on top of this branch (same story, same fixtures). |
| `02-after-device-ready-desktop.png`          | After: the translated text "Dieses Gerät kann die vorhandenen Schlüssel verwenden ..." is shown.                                                                                                                                 |

Not shown by screenshots, covered by tests instead: the other runtime statuses
(`EncryptionSettings.test.tsx`, `it.each` over all statuses), i18n key presence
(`i18n.test.ts`), and the password-change / backup re-check logic of the same fix.
