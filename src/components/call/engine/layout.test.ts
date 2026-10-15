/*
 * SPECIFICATION — the call layout engine
 *
 * These are the acceptance criteria from Ticket 01 of the design handoff,
 * written as tests rather than paraphrased:
 *
 *   - Pure: no DOM, no React, no imports from the app.
 *   - Deterministic: same participant ids in the same order → identical
 *     output, every call.
 *   - packShapes with 2, 4, 9 and 14 names produces no overlap and no shape
 *     clipped by the box.
 *   - Raising one weight from 1 to 1.6 visibly displaces the neighbours
 *     rather than overlapping them.
 *   - Unit-tested at 2, 4, 9, 14 and 18 participants.
 *
 * The functions under test are a VERBATIM port. If one of these fails, the
 * finding belongs to the handoff, not to the port — do not "fix" the engine
 * to make a test pass without saying so out loud.
 */

import { describe, expect, it } from 'vitest';

import {
	type Placement,
	organicSpots,
	ownShape,
	packShapes,
	seeded,
	splitCells
} from './layout';

/** ORISO names, in the shape the engine is seeded with. */
const names = (n: number): string[] =>
	[
		'ruhiger Fuchs 432',
		'später Kauz 512',
		'wacher Igel 118',
		'klarer Schwan 77',
		'naher Otter 303',
		'stilles Pferd 907',
		'weiter Bär 651',
		'heitere Lerche 24',
		'warmer Dachs 260',
		'leiser Reiher 845',
		'offener Hase 391',
		'fester Steinbock 706',
		'milde Amsel 158',
		'heller Marder 523',
		'wacher Luchs 974',
		'sanftes Alpaka Mika',
		'freundliche Katze Mika',
		'absichtslose Schildkröte Andrea'
	].slice(0, n);

const even = (n: number): number[] => Array.from({ length: n }, () => 1);

const BOX = 660;
const COUNTS = [2, 4, 9, 14, 18];

/** Centre-to-centre distance minus the two radii. Negative means overlap. */
const clearance = (a: Placement, b: Placement): number =>
	Math.hypot(
		a.x + a.size / 2 - (b.x + b.size / 2),
		a.y + a.size / 2 - (b.y + b.size / 2)
	) -
	(a.size + b.size) / 2;

const worstClearance = (placed: readonly Placement[]): number => {
	let worst = Number.POSITIVE_INFINITY;
	for (let i = 0; i < placed.length; i++)
		for (let j = i + 1; j < placed.length; j++)
			worst = Math.min(worst, clearance(placed[i], placed[j]));
	return worst;
};

describe('seeded', () => {
	it('gives the same stream for the same string', () => {
		const a = seeded('ruhiger Fuchs 432');
		const b = seeded('ruhiger Fuchs 432');
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it('gives different streams for different people', () => {
		expect(seeded('ruhiger Fuchs 432')()).not.toBe(
			seeded('später Kauz 512')()
		);
	});
});

describe('ownShape', () => {
	it('is deterministic — the same person is the same form, always', () => {
		expect(ownShape('wacher Igel 118')).toEqual(ownShape('wacher Igel 118'));
	});

	it('gives two people different forms', () => {
		expect(ownShape('wacher Igel 118')).not.toEqual(
			ownShape('klarer Schwan 77')
		);
	});

	it('renders a valid eight-value border-radius', () => {
		expect(ownShape('naher Otter 303').blob).toMatch(
			/^\d+% \d+% \d+% \d+% \/ \d+% \d+% \d+% \d+%$/
		);
	});
});

describe('packShapes', () => {
	it.each(COUNTS)('is deterministic at %i participants', (n) => {
		expect(packShapes(names(n), BOX, even(n))).toEqual(
			packShapes(names(n), BOX, even(n))
		);
	});

	it.each(COUNTS)('keeps every one of %i shapes inside the box', (n) => {
		for (const p of packShapes(names(n), BOX, even(n))) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.x + p.size).toBeLessThanOrEqual(BOX);
			expect(p.y + p.size).toBeLessThanOrEqual(BOX);
			expect(p.size).toBeGreaterThan(0);
		}
	});

	// Ticket 01, acceptance: "no overlap" at 2, 4, 9 and 14.
	it.each([2, 4, 9, 14])('leaves %i shapes clear of each other', (n) => {
		expect(worstClearance(packShapes(names(n), BOX, even(n)))).toBeGreaterThanOrEqual(0);
	});

	// Ticket 01, acceptance: raising one weight displaces rather than overlaps.
	it('displaces the neighbours when one weight goes from 1 to 1.6', () => {
		const n = 9;
		const quiet = packShapes(names(n), BOX, even(n));
		const loud = packShapes(
			names(n),
			BOX,
			even(n).map((w, i) => (i === 4 ? 1.6 : w))
		);

		expect(loud[4].size).toBeGreaterThan(quiet[4].size);

		// The others give up room rather than being painted over.
		const others = [0, 1, 2, 3, 5, 6, 7, 8];
		const area = (ps: Placement[]) =>
			others.reduce((t, i) => t + ps[i].size ** 2, 0);
		expect(area(loud)).toBeLessThan(area(quiet));
		expect(worstClearance(loud)).toBeGreaterThanOrEqual(0);
	});
});

describe('organicSpots', () => {
	it.each(COUNTS)('is deterministic at %i participants', (n) => {
		expect(organicSpots(names(n), BOX, even(n))).toEqual(
			organicSpots(names(n), BOX, even(n))
		);
	});

	it('gives a smaller group bigger shapes', () => {
		const mean = (ps: Placement[]) =>
			ps.reduce((t, p) => t + p.size, 0) / ps.length;
		expect(mean(organicSpots(names(4), BOX, even(4)))).toBeGreaterThan(
			mean(organicSpots(names(14), BOX, even(14)))
		);
	});
});

describe('splitCells', () => {
	const rect = { x: 0, y: 0, w: 960, h: 540 };

	it.each(COUNTS)('gives each of %i participants exactly one cell', (n) => {
		const cells = splitCells([...Array(n).keys()], rect, -1);
		expect(cells).toHaveLength(n);
		expect(new Set(cells.map((c) => c.i)).size).toBe(n);
	});

	it.each(COUNTS)('tiles the rectangle exactly at %i participants', (n) => {
		const cells = splitCells([...Array(n).keys()], rect, -1);
		const covered = cells.reduce((t, c) => t + c.w * c.h, 0);
		expect(covered).toBe(rect.w * rect.h);
	});

	it('gives the speaker more than the mean', () => {
		const n = 9;
		const cells = splitCells([...Array(n).keys()], rect, 4);
		const speaker = cells.find((c) => c.i === 4);
		const mean = (rect.w * rect.h) / n;
		expect(speaker).toBeDefined();
		expect((speaker as (typeof cells)[number]).w * (speaker as (typeof cells)[number]).h).toBeGreaterThan(mean);
	});

	it('is deterministic', () => {
		expect(splitCells([0, 1, 2, 3], rect, 2)).toEqual(
			splitCells([0, 1, 2, 3], rect, 2)
		);
	});
});
