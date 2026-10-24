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
