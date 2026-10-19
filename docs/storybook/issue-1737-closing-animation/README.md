# Closing animation of every waiting room (ORISO-Frontend#1737)

Contact sheets of the two designs, made from the Storybook stories
`Entry flows/Closing animation` → `Try curtain`, `Try slide reveal`
(and their `Phone` variants). A script presses the gate button and freezes the Web
Animations at fixed instants: 60 ms into the cover, 300 ms and 430 ms into the reveal.

- `01`, `02` — **before**: what every person got until now, and what a person with
  reduced motion still gets: the room, then the message field in the next frame.
- `03`, `04`, `07`, `08` — **after**: the room, the screen being covered, two frames of the reveal,
  and the message field the person arrives on.

What these images prove: the geometry of each design at those instants, on a
1440 px desktop and a 390 px phone. What they cannot show: timing, easing and
smoothness. Those are covered by the Storybook contract
(`src/components/transition/closing/closingAnimation.stories.tsx`) and the unit tests.
