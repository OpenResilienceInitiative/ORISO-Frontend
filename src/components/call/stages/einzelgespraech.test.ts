import { describe, expect, it } from 'vitest';

import {
	EVEN_SHARE,
	MAX_SHARE,
	SEAM_EASING,
	seamFor,
	shareFor
} from './einzelgespraech';

/*
 * SPECIFICATION — Einzelgespräch, ticket 04
 *
 * "The most common ORISO call: one advice seeker, one counsellor. A single
 * circle divided into two halves along a soft seam."
 *
 * The acceptance list is about MOTION and BALANCE rather than pixels:
 *
 *   - Silence: an even split, neither half favoured.
 *   - The speaking half's share grows past 50% and the seam bows toward the
 *     quiet side.
 *   - Turn-taking reads as one continuous motion — never a snap.
 *
 * "Neither half favoured" is the one a careless implementation breaks: it is
 * tempting to treat the counsellor, or the local participant, as the default
 * speaker. In a counselling call that would quietly give the professional
 * more room than the person who came for help.
 */

describe('shareFor', () => {
	it('splits evenly when nobody is speaking', () => {
		// Not 50.1%. In this room an unearned advantage to either side is a
		// statement, and silence is not a statement.
		expect(shareFor('none')).toBe(EVEN_SHARE);
		expect(EVEN_SHARE).toBe(0.5);
	});

	it('splits evenly when both are speaking', () => {
		expect(shareFor('both')).toBe(EVEN_SHARE);
	});

	it('gives the speaking side more than half', () => {
		expect(shareFor('first')).toBeGreaterThan(EVEN_SHARE);
		expect(shareFor('second')).toBeLessThan(EVEN_SHARE);
	});

	it('is symmetric — neither side is the favoured one', () => {
		// The counsellor is not the default. Mirror the input, mirror the
		// output exactly.
		expect(shareFor('first') + shareFor('second')).toBeCloseTo(1, 10);
	});

	it('never takes the whole circle', () => {
		// The quiet person is still in the conversation and must stay visible.
		for (const who of ['first', 'second'] as const) {
			expect(shareFor(who)).toBeLessThanOrEqual(MAX_SHARE);
			expect(shareFor(who)).toBeGreaterThanOrEqual(1 - MAX_SHARE);
		}
	});
});

describe('seamFor', () => {
	it('is straight when the split is even', () => {
		expect(seamFor(EVEN_SHARE)).toBe(0);
	});

	it('bows toward the quiet side', () => {
		// The seam bulges into whoever is NOT speaking, which is what makes
		// the growth read as one body pressing against another rather than a
		// bar chart.
		expect(seamFor(0.62)).toBeGreaterThan(0);
		expect(seamFor(0.38)).toBeLessThan(0);
	});

	it('bows further the more lopsided the split', () => {
		expect(seamFor(0.62)).toBeGreaterThan(seamFor(0.55));
	});

	it('moves continuously, with no jump at the midpoint', () => {
		// Turn-taking has to read as one motion. A discontinuity here would
		// show up as a flick exactly when the turn passes.
		const step = (a: number, b: number) =>
			Math.abs(seamFor(a) - seamFor(b));
		expect(step(0.499, 0.501)).toBeLessThan(0.02);
	});
});

describe('the transition', () => {
	it('is the easing the ticket names, and never a snap', () => {
		expect(SEAM_EASING).toContain('0.45s');
		expect(SEAM_EASING).toContain('cubic-bezier(0.2, 0, 0, 1)');
	});
});
