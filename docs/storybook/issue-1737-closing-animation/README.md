# Closing animation of every waiting room (ORISO-Frontend#1737)

Contact sheets of the two designs, made from the Storybook stories
`Entry flows/Closing animation` → `Try curtain`, `Try slide reveal`
(and their `Phone` variants). A script presses the gate button and freezes the Web
Animations at fixed instants: 60 ms into the cover, 300 ms and 430 ms into the reveal.

- `01`, `02` — **before**: what every person got until now, and what a person with
  reduced motion still gets: the room, then the message field in the next frame.
- `03`, `04`, `07`, `08` — **after**: the room, the screen being covered, two frames of the reveal,
  and the message field the person arrives on.

Re-shot on 2026-10-19 at `8f43d89d3`: the curtain is the pleated one, the slide reveal runs on the shared
timeline. The flat red band above and below the folds is the part of the screen outside the
room's content box (top bar, bottom edge); it travels with its half.

What these images prove: the geometry of each design at those instants, on a
1440 px desktop and a 390 px phone. What they cannot show: timing, easing and
smoothness. Those are covered by the Storybook contract
(`src/components/transition/closing/closingAnimation.stories.tsx`) and the unit tests.

## The cover carried into the next document (live chat)

The live-chat room starts the chat by replacing the whole page, so the red used
to vanish with the old page and the chat appeared without a reveal. The old
document now leaves a short note as it goes, and the next document covers its page
with the same red before anything else is on it, then opens it onto the message
field. Frames from the Storybook stories `Try it — the page is replaced (curtain |
slide reveal)`: the old page sits in a frame that the browser really
navigates to a new document. The new document has no palette of its own; the blue is
the old page's palette, handed over.

- `09` — **before**: the new document after the page was replaced, with no note
  left. What a person got until now: the chat, no cover, no reveal. (The new
  document is a stub with a white content card and a message field.)
- `10` — **after, first frame of the new document**: the finished cover, in the
  tenant's colours, before the reveal starts (one image per design).
- `11` — **after, 300 ms into the reveal**, in the new document (one image per design).
- `12` — **after**: the new document once the reveal is over, nothing left on the page.

Re-shot on 2026-10-19 after the circle zoom was taken out and the curtain became the
pleated one. Taken in Chrome from Storybook with the Web Animations of the reveal frozen at
those instants (`10` holds the cover by keeping the field away for a moment). They show shapes, not timing; the contract stories
`… hands over to the next document` and the unit tests cover that.
