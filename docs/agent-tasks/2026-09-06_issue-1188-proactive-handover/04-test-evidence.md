# 04 — Test evidence (#1188)

Node 22.12.0, branch `claude/1188/handover-menu-message-avatar` (from `upstream/dev` @ `85c6d208`).

| Check                                                                            | Result                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run --project unit src/components/askerInfo`                         | 4/4 (TDD: all 4 failed first — "Unable to find an element by: [data-testid=user-avatar]")                                                                                                                                                               |
| `npx vitest run --project unit src/components/app/SessionsZone.routing.test.tsx` | 15/15 (4 new #1188 guard cases)                                                                                                                                                                                                                         |
| `npm run lint:scripts` (eslint + tsc)                                            | pass                                                                                                                                                                                                                                                    |
| `npx stylelint src/components/askerInfo/askerInfo.styles.scss`                   | pass                                                                                                                                                                                                                                                    |
| `npm run test:unit`                                                              | **369/369 files, 4032/4032 tests**                                                                                                                                                                                                                      |
| `npm run lint:style` (whole repo)                                                | **fails on `dev` too** — pre-existing errors in `profile.styles.scss`, `PseudonymCard.styles.scss`, `stage.styles.scss`, `StageLayout.styles.scss`; verified by stashing this branch's only scss change and re-running (same exit 2). Not touched here. |

## Job-by-job

**Job 1 — no menu entry 404s.** "Fall Übergabe" exists in no ref of this repository (own pickaxe, all branches) and the chatroom-settings menu has no handover entry; case handover is reached from the session-list card and the in-chat curtain. The "Advice seeker profile" entry resolves: `SessionMenu` builds it with `generatePath`, react-router 7.18 percent-encodes the `:` of the Matrix room id (`!qOTUe…%3Amatrix.oriso.org`) and the route still matches. Guarded by 4 new cases in `SessionsZone.routing.test.tsx` that render the real `SessionsZone` at exactly those generated links (with-room, enquiry-without-room, back-to-session, and an encoding assertion).

**Job 2 — handover system message.** No change needed; verified. `05175d2a` (PR #1055) is an ancestor of `upstream/dev` via sync PR #1178. Storybook, no "needs live data" panel:

- `screenshots/01-job2-handover-system-message.png` — `Components/Chat/MessageItem › Case handover granted (system card)`: Carimat robot avatar, bold headline "Neue Berater:in hat deinen Fall übernommen", subtitle, styled bubble with reason + explanation, timestamp, left aligned.
- `screenshots/02-job2-took-over-notice-desktop.png` and `03-job2-took-over-notice-mobile-320.png` — the same notice at desktop and 320px (AC4).

**Job 3 — profile animal icon.** `AskerInfo` now renders `UserAvatar` at 72px keyed on `askerMatrixUserId ?? user.username` — the same derivation the session list uses, so the profile shows the same animal. Dead CSS removed (`&__icon--user`, and the white plate that the avatar's own ring hid). Live-app screenshot pending a counsellor login.
