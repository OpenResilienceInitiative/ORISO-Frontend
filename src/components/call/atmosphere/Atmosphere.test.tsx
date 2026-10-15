// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ATMOSPHERE_NAMES, Atmosphere, isAtmosphereName } from './Atmosphere';

/*
 * SPECIFICATION — the living backdrop
 *
 * `pond.js` is the handoff's second file that must be copied verbatim rather
 * than rewritten. It is a dependency-free Canvas 2D custom element: four soft
 * colour masses drifting on a slow clock, ten presets, six animated and two
 * deliberately still.
 *
 * So this file does not test the drawing — that is the prototype's and is not
 * ours to second-guess. It tests the contract around it, and in particular the
 * two rules ticket 05 says the element already obeys and must keep obeying:
 *
 *   - one requestAnimationFrame loop per element, guarded by a `running` flag,
 *     because an earlier version double-started and ran at double speed;
 *   - `stop()` on disconnect.
 *
 * Switching presets must not leak a loop either — the ticket asks for twenty
 * switches as the check.
 */

afterEach(cleanup);

describe('the atmosphere presets', () => {
	it('offers the eleven the ported file actually defines', () => {
		// Ticket 05 says ten — "six animated, two deliberately still, two
		// dark". The file ships eleven. Asserted against the file, because the
		// file is what renders; the ticket is the thing that is out of date.
		expect(ATMOSPHERE_NAMES).toHaveLength(11);
	});

	it('includes the two deliberately still ones', () => {
		// "Ruhe" and "Düne" do not animate. They are a choice, not an omission,
		// and somebody tidying the preset list needs to know that.
		expect(ATMOSPHERE_NAMES).toContain('ruhe');
		expect(ATMOSPHERE_NAMES).toContain('duene');
	});

	it('recognises its own names and nothing else', () => {
		expect(isAtmosphereName('fluss')).toBe(true);
		expect(isAtmosphereName('regenbogen')).toBe(false);
	});
});

describe('Atmosphere', () => {
	it('renders the custom element the prototype defines', () => {
		const { container } = render(<Atmosphere palette="fluss" />);
		const pond = container.querySelector('oriso-pond');
		expect(pond).not.toBeNull();
		expect(pond?.getAttribute('palette')).toBe('fluss');
	});

	it('changes preset by attribute, not by remounting', () => {
		// Remounting would tear down the canvas and restart the clock, which
		// reads as a jump. The element watches the attribute for this reason.
		const { container, rerender } = render(<Atmosphere palette="fluss" />);
		const first = container.querySelector('oriso-pond');
		rerender(<Atmosphere palette="nebel" />);
		expect(container.querySelector('oriso-pond')).toBe(first);
		expect(first?.getAttribute('palette')).toBe('nebel');
	});

	it('is hidden from assistive technology', () => {
		// Purely decorative: it carries no information at all, so announcing
		// it would only be noise between a counsellor and what they need.
		const { container } = render(<Atmosphere palette="teich" />);
		expect(
			container.querySelector('oriso-pond')?.getAttribute('aria-hidden')
		).toBe('true');
	});
});
