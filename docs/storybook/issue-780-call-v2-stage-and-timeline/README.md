# ORISO-Frontend#780 — the call stage and the call in the room timeline

Fifteen plates from Storybook, shot with
`node scripts/shootCallEvidence.mjs <outDir>` against `npm run storybook`,
at a 1x device pixel ratio, locale `de-DE`, timezone `Europe/Berlin`.

**Five of them can no longer be re-shot from this repository, and that is the
point.** `06` to `09` and `12` were taken from the host's own copy of the
stage — the Hain, the Felder, the Einzelgespräch, the atmospheres and the
view switcher. That copy has been deleted: the call is drawn by
ORISO-ElementCall, and a second implementation that nothing renders is where
the next design fix would have landed while every test here stayed green. The
plates stay as the evidence this pull request was reviewed with; the living
pictures of those arrangements are in the fork, under `docs/evidence/`,
shot by `scripts/shootOrisoStage.mjs` there. What `shootCallEvidence.mjs`
still reproduces is what this repository still renders: the timeline cards,
the appointment fix and the notes.

What each plate proves, and what it cannot:

| Plate                                                      | What it shows                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-before-call-event-running`                             | The call event the room timeline was **designed** to show before this branch (`VideoChatDetails`, the approval surface from #1659). It has never appeared in the product: nothing ever sent the `VIDEOCALL` alias message, which is what #780 is about. A "before" of a drawing, not of a working feature. |
| `01-after-timeline-running`                                | The running card this branch writes instead: live presence, a duration that is absent while it runs, and the **Beitreten** button.                                                                                                                                                                         |
| `02-before-call-event-ended`                               | The same predecessor, ended — a log line with a duration and no attendance.                                                                                                                                                                                                                                |
| `02-after-timeline-ended`                                  | The ended card: who was there (attendance, not presence), the duration, and no Join button.                                                                                                                                                                                                                |
| `03-after-timeline-missed`                                 | A call nobody answered. It reads **Verpasst** with no duration — not "ended" with the ringing time, which is what the old lifecycle wrote.                                                                                                                                                                 |
| `04-after-timeline-in-the-message-list`                    | The same card inside the real message list, with the day divider and the avatars, rather than on its own.                                                                                                                                                                                                  |
| `05-before-appointment-time` / `05-after-appointment-time` | A 09:00Z appointment seen from Europe/Berlin. Before: **13:00 – 13:50**, the UTC offset added twice by `convertUTCDateToLocalDate(...).toLocaleString('en-ZA')`. After: **11:00 – 11:50**.                                                                                                                 |
| `06-after-hain-spricht`                                    | The Hain with nine people, one of them speaking: the halo and the rise.                                                                                                                                                                                                                                    |
| `07-after-felder-scrollt`                                  | The Felder past eight people, where the fields stop subdividing and the sheet scrolls.                                                                                                                                                                                                                     |
| `08-after-einzelgespraech`                                 | The two-person circle, with the seam moved towards the person who is speaking.                                                                                                                                                                                                                             |
| `09-after-atmosphaeren`                                    | All eleven atmosphere presets side by side.                                                                                                                                                                                                                                                                |
| `10-after-notizen-neben-der-buehne`                        | Gesprächsnotizen docked **beside** the stage at a wide viewport — the dock, measured as 0px² overlap at the time by `shootCallStages.mjs`, which went with the stage copy. The story now puts a placeholder where the Hain stood; what it shows is the panel not covering its neighbour.                   |
| `11-after-notizen-beschrieben`                             | The notes panel with notes in it, including the line that says they are private and last only as long as the call.                                                                                                                                                                                         |
| `12-after-wechsler-ueber-der-buehne`                       | The view switcher over a stage: the three views, with the active one named.                                                                                                                                                                                                                                |

Not shown here, and deliberately:

- **The stage plates are Storybook only, and historical.** They were shot
  from the host-side copy before it was removed; what a real call renders
  lives in `ORISO-ElementCall` (#83, merged). The pictures are the same
  design, not a photograph of a call.
- **The keyboard behaviour** of the stage resize handles, the view switcher's
  roving focus and the notes panel's announcements cannot be photographed.
  They are covered by tests — `GroupCallWidget` and `Gespraechsnotizen` here,
  the view switcher's in the fork — and by the Storybook play functions,
  which run in CI.
- **The call itself**, with two accounts and the fork deployed, is step 5 to 8
  of the reviewer test plan on the pull request. No screenshot here shows
  that, and none should be read as showing it.
