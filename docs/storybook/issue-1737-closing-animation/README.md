# Closing animation of every waiting room (ORISO-Frontend#1737)

Contact sheets of the one design, the slide reveal, made from the Storybook stories
`Entry flows/Closing animation` → `Try it — slide reveal, sideways` (desktop) and
`Try it — slide reveal, upward, phone`. A script presses the gate button and freezes the
Web Animations at fixed instants: 60 ms into the cover, 300 ms and 430 ms into the reveal.

- `01`, `02` — **before**: what every person got until now, and what a person with
  reduced motion still gets: the room, then the message field in the next frame.
- `03` — **after, desktop (1440 px)**: the red area swipes to the right, a second red
  layer trails it, the message field is uncovered.
- `04` — **after, phone (390 px)**: the same swipe goes upward, from the bottom of the
  screen to the top, because the screen is one column. The darker trailing layer sits
  below the front one.

The line between the two is 1200 px (`CLOSING_DESKTOP_MIN_WIDTH`): at that width and
above the room stands beside the brand stage and the swipe goes sideways; narrower
(a phone, a tablet) it goes upward.

What these images prove: the geometry of the design at those instants. What they cannot
show: timing, easing and smoothness. Those are covered by the Storybook contract
(`src/components/transition/closing/closingAnimation.stories.tsx`) and the unit tests.

## The cover carried into the next document (live chat)

The live-chat room starts the chat by replacing the whole page, so the red used
to vanish with the old page and the chat appeared without a reveal. The old
document now leaves a short note as it goes, and the next document covers its page
with the same red before anything else is on it, then opens it onto the message
field, in the direction the old document chose (sideways on a desktop width, upward on
a phone). Frames from the Storybook stories `Try it — the page is replaced, sideways` and
`… upward, phone`: the old page sits in a frame that the browser really
navigates to a new document. The new document has no palette of its own; the blue is
the old page's palette, handed over.

- `09` — **before**: the new document after the page was replaced, with no note
  left. What a person got until now: the chat, no cover, no reveal. (The new
  document is a stub with a white content card and a message field.)
- `10` — **after, first frame of the new document**: the finished cover, in the
  tenant's colours, before the reveal starts (`sideways` on 1440 px, `upward-phone` on 390 px).
- `11` — **after, 300 ms into the reveal**, in the new document (same two widths). Sideways
  the red leaves to the right with its darker trail on the left; upward it leaves at the
  top and the room comes up from the bottom.
- `12` — **after**: the new document once the reveal is over, nothing left on the page
  (desktop).

Re-shot on 2026-10-20 after #1766 made the slide reveal the only design. Taken in Chrome from Storybook with the Web Animations of the reveal frozen at
those instants (`10` holds the cover by keeping the field away for a moment). They show shapes, not timing; the contract stories
`… hands over to the next document` and the unit tests cover that.
