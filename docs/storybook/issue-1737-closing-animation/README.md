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
