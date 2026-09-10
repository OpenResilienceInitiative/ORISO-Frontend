# 00 — Problem brief: Pro-active case handover (#1188)

- **Issue:** [#1188](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1188) — "Pro-active case handover: menu entry 404s, system message styling, profile animal icon"
- **Branch:** `claude/1188/handover-menu-message-avatar` (from `upstream/dev` @ `85c6d208`)
- **Target:** PR → `OpenResilienceInitiative:dev`
- **Image:** `screenshots/issue-annotated-report.png` (4 panels; observed on dev.oriso.org v2.0.3)
- **Assignees:** Shirloin, Storypapst, nikunjdecyb

## Jobs transcribed from the annotated image (binding)

| Mark in image                        | Verbatim                                                                                                                                                                                                               | Arrow target                                                                                                                             | Issue job         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| (top, unlabelled)                    | German chatroom-settings menu entry **"Fall Übergabe"** — "Wählen sie ein oder mehrere Fälle aus welche sie weiterleiten möchten" (⇧Ü) → the app's 404 screen ("Ohh! … Wir konnten die gewünschte Seite nicht finden") | menu entry → 404 page                                                                                                                    | Job 1             |
| **JOB3** — prio high, effort s       | "Cant click on further. No matter what reason i did select"                                                                                                                                                            | the **"Advice seeker profile"** entry (⇧P) in the English chatroom-settings menu                                                         | Job 1 (same menu) |
| **JOB4** — prio medium, effort small | "Change icon to the default animal icon"                                                                                                                                                                               | the generic person glyph in the advice-seeker **Profile** header (`schildkrote_hedi_5707`)                                               | Job 3             |
| **JOB4** — prio urgent, effort low   | "This message must be embeded in standard Carimat message design. And correcly alligned"                                                                                                                               | the handover notice in chat ("Selected reason: Other emergency / … Aus einem dringenden Grund hat Lisa Simpson deinen Fall übernommen.") | Job 2             |

Legend note from the issue: yellow = headline claim (Frank Gerhardt, 11 May 2026, "Pro-Active Case Hand Over Counsellor"); red = defect location.

## Constraints from the archaeology comment (2026-08-26)

- "Fall Übergabe" has **zero hits** in this repo's history (all branches, pickaxe) and no `*handover*` route exists in any `RouterConfig` revision → the entry's origin is outside the examined refs; identify on the live build before removing/routing.
- Job 2's redesign landed on pre-dev (`05175d2a` / PR #1055, plus #1064, #1112). **Verified 2026-09-06: `05175d2a` is now contained in `upstream/dev`** (sync PR #1178 merged 2026-08-31) → only remainders are in scope.
- The "Unable to decrypt … key backup is not working" bubbles in the screenshots belong to the encryption sub-issue, not here.

## Acceptance criteria (from the issue)

- [ ] AC1 No menu entry leads to a "page not found" screen
- [ ] AC2 Handover system messages render in the standard system-message design, correctly aligned
- [ ] AC3 Advice-seeker profile shows the animal avatar, not a generic person icon
- [ ] AC4 All three hold at a 320px viewport
- [ ] AC5 `test:unit`, `lint:scripts`, `lint:style`, `build` pass

## Non-goals

- Building a real case-handover wizard (the in-chat curtain flow is separate work).
- Encryption / key-backup errors visible in the same screenshots.
