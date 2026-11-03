# Closing animation of every waiting room (ORISO-Frontend#1737)

Contact sheets of the one design, the wave reveal, made from the Storybook stories
`Entry flows/Closing animation` → `Try it — wave reveal, desktop` and
`Try it — wave reveal, phone`. A script presses the gate button and freezes the Web
Animations at fixed instants: 80 ms into the cover, then 400 ms and 460 ms into the
reveal (the reveal starts slowly and ends fast, so these two are its last third).

- `01`, `02` — **before**: what every person got until now, and what a person with
  reduced motion still gets: the room, then the message field in the next frame.
- `03` — **after, desktop (1440 px)**: one big calm red sheet with a wave at each end
  comes up from below, covers the room (frame 3 is one flat colour), leaves at the top,
  and the message field is uncovered.
- `04` — **after, phone (390 px)**: the same, on one column. The wave is shallower there
  (16% of the screen height at most), so it never turns into a bowl.
- `05` — **colours**: the same instant (400 ms into the reveal, desktop) with six Träger
  colours: the platform red, blue, green, a light amber, a dark navy and pink. Only the
  fill changes. The wave is drawn in the Träger's primary colour and in nothing else: no
  tint, shade or gradient is derived from it, so a colour that a Träger picks needs no
  second colour next to it.

There is one direction. The sheet always sweeps upward, on a phone, a tablet and a desktop.

What these images prove: the geometry and the colour of the design at those instants.
What they cannot show: timing, easing and smoothness. Those are covered by the Storybook
contract (`src/components/transition/closing/closingAnimation.stories.tsx`) and the unit
tests.

## The cover carried into the next document (live chat)

The live-chat room starts the chat by replacing the whole page, so the colour
used to vanish with the old page and the chat appeared without a reveal. The old
document now leaves a short note as it goes, and the next document covers its page
with the same sheet before anything else is on it, then opens it onto the message
field, upward like everywhere else. Frames from the Storybook stories
`Try it — the page is replaced` and `Try it — the page is replaced, phone`: the old
page sits in a frame that the browser really navigates to a new document. The new
document has no palette of its own; the blue is the old page's palette, handed over
(the note carries the Träger's primary colour and the place the reveal ends on, and
nothing else).

- `09` — **before**: the new document after the page was replaced, with no note
  left. What a person got until now: the chat, no cover, no reveal. (The new
  document is a stub with a white content card and a message field.)
- `10` — **after, first frame of the new document**: the finished cover, in the
  tenant's colour, before the reveal starts (`desktop` on 1440 px, `phone` on 390 px).
- `11` — **after, 300 ms into the reveal**, in the new document (same two widths).
  The sheet leaves at the top with its wave, and the room comes up from the bottom.
- `12` — **after**: the new document once the reveal is over, nothing left on the page
  (desktop). It is the same screen as `09` on purpose: what changes is the way there
  (`10` and `11`), not where the person ends up.

Re-shot on 2026-10-20 after #1766 made the wave reveal the only design, always upward.
Taken in Chrome from Storybook with the Web Animations of the reveal frozen at
those instants (`10` holds the cover by keeping the field away for a moment). They show shapes, not timing; the contract stories
`Wave reveal — the cover carries over into the next document` (desktop and phone) and the unit tests cover that.
