# #1915 Beratungsstellen-Admin kontaktieren

Source: Storybook `Organisms/AgencyAdminContact` (`src/components/profile/AgencyAdminContact.stories.tsx`).
The stories answer `GET /users/agencies/{id}/admin-contacts` and
`POST /users/chat/internal-subset` with a fetch stand-in; no backend is involved.

New feature, no before state: there is no Storybook story for the Beratungsstellen
section on `dev`, and the link did not exist before.

| Image                                                 | Proves                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-after-admins-desktop.png` / `-phone390.png`       | With an admin on file the centre shows the link "Beratungsstellen-Admin kontaktieren".                                                                                                                                                                                                                                              |
| `02-after-no-admin-desktop.png` / `-phone390.png`     | No admin reachable by chat: the hint "Kein Admin per Chat erreichbar – bitte wende dich an die Plattformverwaltung." replaces the link (no dead button) and, with a support address set in the global settings, a mailto link to it follows. Without an address the hint stands alone (story `NoAdminNoSupportEmail`, unit-tested). |
| `03-after-load-error-desktop.png` / `-phone390.png`   | Admin list failed to load: an error hint replaces the link.                                                                                                                                                                                                                                                                         |
| `04-after-chat-refused-desktop.png` / `-phone390.png` | A refused chat call (encryption unavailable) shows its reason next to the link; nothing is created.                                                                                                                                                                                                                                 |

Desktop = 900 px viewport, phone = 390 px viewport (both at 2x).

Not shown by screenshots, covered by tests instead: that the chat room is
created or reused for exactly the admins, navigation into the room, the
"reused" notice, double-click protection and the chat-name length limits
(unit tests of `AgencyAdminContact` and `useInternalSubsetChatSubmit`). The
stand-in only mimics server answers; it is not evidence of backend behaviour.
