import { describe, expect, it } from 'vitest';

import { NAME_MAX_PX, NAME_SHAPE_SHARE, nameMaxWidth } from './HainStage';

/*
 * The capsule's ceiling.
 *
 * A name capsule wider than its own shape hangs over the neighbours, and the
 * Hain packs shapes until they abut — so the shape, not a constant, is the
 * binding limit on a small shape. On a large one the absolute ceiling takes
 * over, or one long pseudonym would stretch into a banner.
 */
describe('nameMaxWidth', () => {
	it('never exceeds the shape it sits on', () => {
		for (const size of [84, 120, 180, 240, 400])
			expect(nameMaxWidth(size)).toBeLessThanOrEqual(size);
	});

	it('is bound by the shape while the shape is the smaller limit', () => {
		expect(nameMaxWidth(120)).toBe(Math.round(120 * NAME_SHAPE_SHARE));
	});

	it('is bound by the absolute ceiling on a large shape', () => {
		expect(nameMaxWidth(400)).toBe(NAME_MAX_PX);
	});

	it('is wider than the handoff flat value where there is room', () => {
		// The whole point: with a raised hand and its duration, 132px left the
		// name about forty pixels.
		expect(nameMaxWidth(240)).toBeGreaterThan(132);
	});
});
