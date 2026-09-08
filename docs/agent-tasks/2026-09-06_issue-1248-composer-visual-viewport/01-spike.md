# #1248 — maximised composer sizes to the layout viewport, not the visible one

## The defect

Two places resolved against the layout viewport, which iOS Safari does **not**
shrink when the soft keyboard opens:

- `messageSubmitInterfaceComponent.tsx` — `expandedComposerStyle` returned
  `{ position: 'fixed', inset: 0 }`. `inset: 0` covers the full layout
  rectangle, roughly twice the visible height with a keyboard up.
- `messageSubmitInterface.styles.scss` — the editor itself is
  `position: fixed` with `bottom: 24px`, `height: min(78vh, 760px)` and
  `max-height: calc(100dvh - 96px)`. `bottom` was measured from the bottom of
  the layout viewport, i.e. from behind the keyboard, and `vh`/`dvh` are the
  large viewport.

The issue named the missing mechanism exactly: `window.visualViewport` was used
nowhere in the repo.

## The fix

`src/hooks/useVisualViewport.ts` — reports the visible height, the offset, and
the bottom inset (`window.innerHeight - height - offsetTop`, which is the
keyboard). Listens to both `resize` and `scroll`, because iOS shifts the visual
viewport inside the layout one as well as resizing it. Returns `null` where the
API is absent so callers fall back to `100dvh`.

The composer publishes those numbers as two custom properties on the overlay,
`--composer-visible-height` and `--composer-viewport-bottom`, which the
stylesheet consumes:

```scss
bottom: calc(var(--composer-viewport-bottom, 0px) + 24px) !important;
height: min(calc(var(--composer-visible-height, 100dvh) * 0.78), 760px);
max-height: calc(var(--composer-visible-height, 100dvh) - 96px);
```

The fallbacks are exactly the old values, so a browser without the API behaves
as it does today and desktop is untouched (with no keyboard the visible height
equals the layout height).

The editor body gets `overflow-y: auto` plus `overscroll-behavior: contain`, so
long text scrolls inside the box instead of pushing the toolbar and send button
out of reach, and the page behind does not take over the scroll.

## Two things that were harder than they looked

**A Storybook viewport cannot reproduce this bug.** Shrinking the Playwright or
Storybook viewport shrinks the layout _and_ visual viewport together — there is
no split, so the unfixed code looks correct. The first version of the story
passed against the unfixed code, and the first set of before/after screenshots
came out pixel-identical. Both were rewritten to simulate what iOS actually
does: hold the layout viewport at full height and shrink only
`visualViewport.height`. With that, the story fails on the unfixed code with
`expected 464 to be 232`, and the screenshots differ visibly.

**The play assertions were racing the layout.** The overlay needs a frame or two
after the click before it has its final size; measuring immediately caught an
intermediate 196px and looked like a broken fix. The measurements are inside
`waitFor` now.

## Evidence

`screenshots/before-*` and `screenshots/after-*` — 390x844 and 320x780 with the
layout viewport held full height, only the visual viewport shrunk, and the
keyboard band hatched over. Before: the editor runs past the keyboard line.
After: the whole box sits above it.

`after-desktop-1440x900.png` and `after-mobile-390x844-keyboard-closed.png`
cover the unchanged cases.
