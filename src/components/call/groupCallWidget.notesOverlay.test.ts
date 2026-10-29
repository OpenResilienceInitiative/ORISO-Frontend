import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * The half of the notepad fix that jsdom cannot see.
 *
 * `GroupCallWidget` publishes `data-narrow-stage` when the floating stage is
 * too narrow to seat the 320px notepad beside the call, and the harness test
 * asserts that marker. The marker on its own changes nothing: the behaviour is
 * entirely in the stylesheet, which jsdom neither applies nor parses — the
 * CSS-module and SCSS imports are stubbed, so a test that rendered the widget
 * and measured the panel would measure zero in every case and pass whatever
 * the rule said.
 *
 * So the rule is read as text. The comments are stripped first, because the
 * prose around these rules quotes the selectors it is explaining.
 */
const scss = fs
	.readFileSync(
		path.join(process.cwd(), 'src/components/call/GroupCallWidget.scss'),
		'utf8'
	)
	.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the notepad over a stage with no width to give away', () => {
	it('defines the overlay once and shares it', () => {
		// Two triggers reach the same declarations. Written twice they drift,
		// and the drift is invisible — nothing in this repository renders the
		// panel at a real size.
		const mixin = scss.match(/@mixin notes-over-stage \{([^}]*)\}/)?.[1];
		expect(mixin).toBeDefined();
		expect(mixin).toContain('position: absolute;');
		expect(mixin).toContain('inset-inline-end: 0;');
		expect(mixin).toContain('max-inline-size: 100%;');
	});

	it('lays the expanded panel over a narrow stage', () => {
		// The marker is on the shell and the panel is a descendant, so the
		// selector has to cross that gap — and it must not fire for the
		// collapsed rail, which is a 44px strip the stage can always afford.
		const rule = scss.match(
			/\.element-call-container\[data-narrow-stage='true'\]\s*\.element-call-notes:not\(\[data-collapsed='true'\]\)\s*\{([^}]*)\}/
		)?.[1];
		expect(rule).toBeDefined();
		expect(rule).toContain('@include notes-over-stage;');
	});

	it('keeps the viewport trigger for the two shells the stylesheet sizes', () => {
		// Full screen and the mobile view leave `style` off the shell, so the
		// component does not know its width there and cannot publish the
		// marker. The media query is the measure in those two cases.
		expect(scss).toMatch(
			/@media \(width <= 1279px\) \{\s*\.element-call-notes:not\(\[data-collapsed='true'\]\) \{\s*@include notes-over-stage;/
		);
	});

	it('never takes the notepad away outright', () => {
		// It is the only notepad in the call. `display: none` at a
		// breakpoint left nothing to open, which is the bug the rail replaced.
		expect(scss).not.toMatch(
			/\.element-call-notes[^{]*\{[^}]*display:\s*none/
		);
	});
});

describe("the host's buttons beside the notepad (#1929)", () => {
	it('moves every right-anchored host button left of the notepad', () => {
		// Measured in the call story: the close button sat on the rail's fold
		// button, so the notepad could not be opened from its own rail.
		const blocks = scss.match(
			/\.element-call-(close|fullscreen|autofit) \{[^}]*\}/g
		);
		const anchored = (blocks ?? []).filter((block) =>
			/\bright:/.test(block)
		);
		expect(anchored.length).toBe(5);
		// The drag strip across the top lay over the fold button as well.
		expect(scss).toMatch(
			/\.element-call-drag-handle \{[^}]*right: var\(--call-notes-inset, 0px\);/
		);
		for (const block of anchored)
			expect(block).toMatch(
				/right: calc\(\d+px \+ var\(--call-notes-inset, 0px\)\)/
			);
	});

	it('reserves the rail when folded and the panel when open', () => {
		expect(scss).toMatch(
			/&:has\(> \.element-call-notes\) \{\s*--call-notes-inset: 44px;/
		);
		expect(scss).toMatch(
			/&:has\(> \.element-call-notes:not\(\[data-collapsed='true'\]\)\) \{\s*--call-notes-inset: 320px;/
		);
	});
});
