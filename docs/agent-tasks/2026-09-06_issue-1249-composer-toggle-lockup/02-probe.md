# #1249 — console probe for a real device

Paste into Safari's console on `predev.oriso.org` with a case open, then toggle
maximise/restore by hand. Call `composerProbe()` after each toggle; it prints
what is on top at the editor's centre, whether the editor is reachable, and any
orphaned overlays.

```js
window.composerProbe = () => {
	const ed = document.querySelector('[contenteditable="true"]');
	const r = ed && ed.getBoundingClientRect();
	const cx = r ? Math.round(r.left + r.width / 2) : 0;
	const cy = r ? Math.round(r.top + r.height / 2) : 0;
	const top = document.elementFromPoint(cx, cy);
	const d = (el) => {
		if (!el) return null;
		const cs = getComputedStyle(el);
		return {
			tag: el.tagName.toLowerCase(),
			cls: String(el.className).slice(0, 70),
			pe: cs.pointerEvents,
			z: cs.zIndex,
			pos: cs.position
		};
	};
	return {
		editorAlive: !!ed && ed.getAttribute('contenteditable') === 'true',
		topAtEditorCentre: d(top),
		topIsEditor: !!(top && ed && (ed.contains(top) || top === ed)),
		bodyFixedChildren: [...document.body.children]
			.filter((el) => {
				const cs = getComputedStyle(el);
				return (
					(cs.position === 'fixed' || cs.position === 'absolute') &&
					cs.display !== 'none' &&
					el.getBoundingClientRect().width > 0
				);
			})
			.map(d),
		expandedOverlays: document.querySelectorAll(
			'.messageSubmit__wrapper--expanded'
		).length,
		visualViewport: window.visualViewport && {
			h: Math.round(window.visualViewport.height),
			offsetTop: Math.round(window.visualViewport.offsetTop),
			innerHeight: window.innerHeight
		}
	};
};
```

What to look for when it locks up:

- `topIsEditor: false` → something is over the editor; `topAtEditorCentre` names it.
- `expandedOverlays` greater than 1 → a stale overlay was left behind.
- `bodyFixedChildren` non-empty → an orphaned portal.
- `editorAlive: false` → TipTap was destroyed.
