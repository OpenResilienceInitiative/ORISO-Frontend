# Closing animation of every waiting room (ORISO-Frontend#1737)

Contact sheets of the three designs, made from the Storybook stories
`Entry flows/Closing animation` → `Try curtain`, `Try circle zoom`, `Try slide reveal`
(and their `Phone` variants). A script presses the gate button and freezes the Web
Animations at fixed instants: 60 ms into the cover, 300 ms and 430 ms into the reveal.

- `01`, `02` — **before**: what every person got until now, and what a person with
  reduced motion still gets: the room, then the message field in the next frame.
- `03`–`08` — **after**: the room, the screen being covered, two frames of the reveal,
  and the message field the person arrives on.

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
circle zoom | slide reveal)`: the old page sits in a frame that the browser really
navigates to a new document. The new document has no palette of its own; the blue is
the old page's palette, handed over.

- `09` — **before**: the new document after the page was replaced, with no note
  left. What a person got until now: the chat, no cover, no reveal.
- `10` — **after, first frame of the new document**: the finished cover, in the
  tenant's colours, before the reveal starts (one image per design).
- `11` — **after, 300 ms into the reveal**, in the new document (one image per design).
- `12` — **after**: the new document once the reveal is over, nothing left on the page.

Taken in Chrome from Storybook with the Web Animations of the reveal frozen at those
instants. They show shapes, not timing; the contract stories
`… hands over to the next document` and the unit tests cover that.
