# #1250 — toolbar menus open by a fixed rule, not a collision check

## The defect

`getMenuDirection` returned `isExpanded ? 'down' : 'up'` and nothing else. On a
phone with the composer maximised that meant the ⋮ menu opened _downward_ from a
toolbar already near the bottom edge, so the last entries ran off the screen.

`ToolbarMenu` positioned with floating-ui but deliberately without `flip()`,
with a comment saying flipping "renders the menu over the editor content
instead of on top of the toolbar". `shift()` slides a menu along the cross axis
only — it cannot move it to the other side of the anchor — so once the
direction was wrong nothing recovered it.

## The fix

The Figma rule (node 7086:46390) stays as the **preference**; fitting on screen
overrules it, which is what the issue asks for.

- `flip({ fallbackStrategy: 'bestFit', padding: 8 })` — open the other way when
  the preferred side does not fit, and pick the roomier side when neither does.
- `size({ padding: 8, apply })` — cap `max-height` to the space actually
  available, with `overflow-y: auto` on the menu so it scrolls internally and
  the last entry stays reachable.
- The rendered class now reflects where the menu **landed**
  (`placedDirection`), not where it was asked to go, so the animation origin
  and any styling follow the real placement.

### On the old "no flip()" note

Re-checked rather than taken on trust. With `offset(6)` the flipped menu clears
the trigger by the same 6px it does in the preferred direction, so it never
covers the button that opened it — there is a story assertion for exactly that.
It does overlap editor content, which is what a menu is for, and is plainly
better than putting entries off-screen. The note has been replaced with this
reasoning so the next reader does not restore the old behaviour from the Figma
note.

### `isMobile` removed from `getMenuDirection`

It was accepted and never read, so callers could pass it and believe it did
something. `messageSubmitInterfaceComponent.tsx` did exactly that. Viewport size
is a collision question now and collisions are measured, so the parameter is
gone rather than left as a trap.

## The story problem underneath this

Three stories carried `tags: ['!test']` with the note _"clicking the trigger
never mounts `.composerToolbar__menu` in a real browser, so the assertions below
have never actually held"_. That diagnosis was wrong.

The menu **is** portalled to `document.body`. The assertions queried
`canvasElement` / `within(canvasElement)`, which by construction cannot see a
portal. Pointing them at `document` makes all three pass immediately — no
pointer-event change needed. They are re-enabled.

The harness also computed `direction = isExpanded && !isMobile ? 'down' : 'up'`
while production ignored `isMobile` entirely, so the story modelled a mobile
behaviour the app never had. It calls `getMenuDirection` now, so harness and
production cannot drift again.

One assertion changed meaning deliberately: the docked story asserted the menu
opened _upward_. Under a collision check that is no longer guaranteed — and
should not be. It now asserts the menu is fully on screen, which is the
acceptance condition.

## Evidence

`MobileMaximisedOverflowAtBottomEdge` pins the reported case: a 390x600
viewport, toolbar 8px from the bottom, maximised (so the preference is
downward). It asserts the whole menu is on screen, that the last entry is
reachable, and that the menu does not cover its trigger.

Checked against the unfixed code by reverting `ToolbarMenu.tsx` alone:

```
× Mobile — maximised ⋮ menu at the bottom edge (#1250)
  → expected 978 to be less than or equal to 601
```

The menu's bottom edge was 978px on a 600px-tall viewport — 378px below the
fold. That is the defect, measured.
