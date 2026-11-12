# #2170 — direct call title

Evidence for ORISO-Frontend#2170. Captured on `dev.oriso.org` (Frontend v2.0.15, Element Call
bundle with ORISO-ElementCall#127), 1:1 video call, de-DE, fake camera, synthetic test accounts.

| File                                    | What it proves                                                                                 | What it does not prove                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `01-before-dev-video-counsellor.png`    | Counsellor's side today: the header reads "Anruf". Own picture is the small tile bottom right. | That the room name is clean: Element Call replaces the technical name on screen. |
| `02-before-dev-video-advice-seeker.png` | Advice seeker's side today, same header.                                                       | Same.                                                                            |

The name underneath is still the session room id. Measured on Dev, 2026-11-10, read-only, from the
Matrix state of the call rooms the Frontend created (`m.room.name`):

```text
Group call for !TNiHshcXhxfWrrtulw:dev.oriso.org
```

There is no "after" image yet. The new title is a Matrix room name that only changes once the
UserService and Frontend changes are deployed to Dev. The behaviour is covered by unit tests
(`callRoomName.test.ts`, `CallManager.callRoom.test.ts`, `startRoomCall.test.ts`,
`knockCallAction.test.ts`, `NotificationsCenter.knockCall.test.tsx`).
