import { describe, expect, it } from 'vitest';

import { HALO_LIFT_PX, haloFor, QUIET_SHADOW, tint } from './halo';

/*
 * SPECIFICATION — how speaking looks in the Hain
 *
 * The prototype states both states outright, and states the intent in a
 * comment beside them:
 *
 *   "The halo takes the person's own colour, so speaking reads as
 *    'she lights up' rather than 'the system marked her red'."
 *
 * That sentence is the whole design, and it is the one thing a future
 * refactor is most likely to break — a shared accent colour is the obvious
 * simplification, and it is exactly wrong. So the test asserts the halo is
 * built from the participant's own background and from nothing else.
 */

describe('tint', () => {
	it('turns a palette hex into the same colour at an alpha', () => {
		expect(tint('#FCE7E6', 0.5)).toBe('rgba(252, 231, 230, 0.5)');
	});

	it('takes short hex too, because palettes are written both ways', () => {
		expect(tint('#1F3', 0.18)).toBe('rgba(17, 255, 51, 0.18)');
	});

	it('passes a colour it cannot parse straight through', () => {
		// A palette entry that is already `rgb()` or a CSS keyword should not
		// become `rgba(NaN, NaN, NaN)`.
		expect(tint('rebeccapurple', 0.5)).toBe('rebeccapurple');
	});
});

describe('haloFor', () => {
	it('is quiet and flat when nobody is speaking', () => {
		expect(haloFor('#FCE7E6', false)).toBe(QUIET_SHADOW);
	});

	it("lights up in the speaker's OWN colour, never a system accent", () => {
		const halo = haloFor('#FCE7E6', true);
		// Both coloured layers are the person's background.
		expect(halo).toContain('rgba(252, 231, 230, 0.18)');
		expect(halo).toContain('rgba(252, 231, 230, 0.5)');
		// And no ORISO red anywhere in it.
		expect(halo).not.toContain('165, 0, 10');
		expect(halo.toLowerCase()).not.toContain('#a5000a');
	});

	it('gives two different people two different halos', () => {
		expect(haloFor('#FCE7E6', true)).not.toBe(haloFor('#D6E9CA', true));
	});

	it('carries the deeper drop shadow that makes the shape sit forward', () => {
		expect(haloFor('#FCE7E6', true)).toContain(
			'0 22px 38px -10px rgba(0, 0, 0, 0.24)'
		);
	});

	it('lifts the speaking shape by the handoff four pixels', () => {
		expect(HALO_LIFT_PX).toBe(4);
	});
});
