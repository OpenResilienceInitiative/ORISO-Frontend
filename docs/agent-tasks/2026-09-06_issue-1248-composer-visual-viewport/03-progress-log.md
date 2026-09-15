## Review round 1 (Shazia) — all four points

**1. The keyboard story leaked its stub.** Confirmed: the `finally` block
restored `visualViewport.height` by defining _another_ own property whose
getter returned the captured number. The native getter lives on the prototype,
so every story running after it in the same page saw a frozen height — and
after the merge, `RepeatedMaximiseToggle` (#1249) is one of them. Now restored
with `delete (viewport as …).height`, which uncovers the prototype getter.

**2. Re-render on every visual-viewport tick.** Confirmed: `setMetrics` was
handed a fresh object on each `scroll`/`resize`, and iOS fires `scroll`
continuously during pinch-zoom and while panning with the keyboard up.
`useVisualViewport` now uses a functional update that returns the _previous_
object when height, offsetTop and bottomInset are all unchanged, so React
bails out instead of re-rendering a 4k-line component.

**3. `overflow-y: auto` on `.textarea__input` — dropped.** She was right that
it is redundant, and I could not point at an observed case. `.ProseMirror` is
absolutely positioned inside `.tipTapComposer__content`, which is
`overflow: hidden`, and it carries `overflow-y: auto` itself
(`TipTapComposer.styles.scss`), so the text was already scrolling in its own
box and the outer element can never overflow. Setting only `overflow-y` also
computes `overflow-x` to `auto`, which would make the character counter and
editing banner scroll content for nothing. Rule removed; the maximised story
now asserts which element is the scroll container so this cannot silently flip
back.

**4. Story skipped its key assertion when `visualViewport` was missing.**
Confirmed and fixed: it throws now, so a runner without the API fails loudly
instead of passing green.

Merge with `dev` also resolved: `.gitignore` (both sides added their own
un-ignore pair) and `MessageSubmitInterface.stories.tsx` (both sides appended a
new story) — both additions kept.

Verified after all of it: `lint:scripts` clean, `MessageSubmitInterface.stories.tsx`
19/19 green in the storybook project, with the #1248 keyboard story running
_before_ the #1249 ten-cycle story — the exact ordering the leak would have
broken. `lint:style` reports 17 errors, all in files this branch does not
touch (profile, PseudonymCard, stage, StageLayout).
