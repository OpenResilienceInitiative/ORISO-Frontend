# #1249 — repeated maximise/restore lock-up: reproduction attempt

**Status: not reproduced. Root cause NOT established. This does not close the
issue.**

The issue says so itself — "Root cause is not established. The first work
package here is a reliable reproduction, not a fix" — so this records what was
tried, what it ruled out, and what is still needed.

## What was tried

A scripted harness drove the composer through repeated maximise/restore cycles.
After **every** toggle it recorded, at the editor's centre point:

- which element `document.elementFromPoint` returns, with its `pointer-events`,
  `z-index` and `position` (the issue's job 2);
- whether that element is the editor or inside it;
- any fixed/absolute children parked directly on `document.body` (orphaned
  portals);
- how many `.messageSubmit__wrapper--expanded` overlays exist;
- whether typing a character actually lands in the editor.

| Configuration                                                                 | Cycles | Result                                           |
| ----------------------------------------------------------------------------- | ------ | ------------------------------------------------ |
| Chrome, 390x844, mouse                                                        | 10     | usable after every cycle                         |
| Chrome, 390x844, `hasTouch` + `isMobile`, taps                                | 12     | usable after every cycle                         |
| …plus a toolbar menu opened before each toggle                                | 12     | usable after every cycle                         |
| …plus a simulated keyboard (visualViewport shrink/restore between toggles)    | 12     | usable after every cycle                         |
| **WebKit** (Safari engine), touch + menus + simulated keyboard                | 12     | usable after every cycle                         |
| Emoji picker open (which also opens the compact action strip) across a toggle | —      | toggle control still present, typing still works |

In every run `elementFromPoint` at the editor's centre returned the ProseMirror
node itself with `pointer-events: auto`, `bodyFixedChildren` was empty, and
exactly one expanded overlay existed while maximised (zero while collapsed).

## What that rules out

The three candidates named in the issue are not supported by any of this:

1. **Stale overlay swallowing taps.** The `pointer-events: none` / `auto` pair
   is scoped to `.messageSubmit__wrapper--expanded` and
   `.textarea__wrapper-send-message--expanded`, two classes applied and removed
   together. No intermediate render left the wrong pair, and the element on top
   at the tap point was always the editor.
2. **TipTap destroyed/recreated across the toggle.** The editor kept its
   accumulated content across all twelve cycles and stayed
   `contenteditable="true"`, so the instance survives the toggle.
3. **An unmounted `ToolbarMenu` portal covering the composer.**
   `ToolbarMenu.tsx:84-89` removes both its `pointerdown` and `keydown`
   listeners in the effect teardown, and no orphaned body children were ever
   observed.

A fourth candidate, mine, is also ruled out: `handleOpenEmoji` sets
`isCompactActionStripOpen` and `toggleExpandedComposer` never clears it, so the
maximised toolbar can render the compact strip. It still contains the collapse
control, and typing still works.

## What is still needed

The gap is that this harness drives the Storybook `ComposerShell`, not the real
app. It does not include session chrome, routing, or live Matrix state, and a
simulated `visualViewport` is not a real soft keyboard. The report is
specifically an iPhone on `predev.oriso.org`.

So the next step needs one of:

- a session on a real iOS device against PreDev, with the sequence recorded
  (the acceptance asks for a recording of ten toggles anyway); or
- the same probe run against the real app rather than the story — the probe is
  small and is reproduced in full in `02-probe.md` so it can be pasted into a
  device browser console.

## What this branch does add

`MessageSubmitInterface.stories.tsx` gains a ten-cycle toggle story that asserts
after every single cycle that the editor is still editable and the toggle
control still exists. That is the regression guard the acceptance asks for
("covers repeated toggling — not a single toggle"). It passes today, which is
the point: it will fail if the toggle path itself regresses.
