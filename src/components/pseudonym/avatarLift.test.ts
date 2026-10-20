import { describe, expect, it } from 'vitest';

import { AVATAR_LIFT, LIFT_MAX_AT, liftFor } from './avatarLift';

/*
 * SPECIFICATION — how far a shape lifts off the surface
 *
 * One shadow judged on a 104px avatar does not read at all on a 440px call
 * tile: at that size `0 2px 8px` is a smudge under one edge, and the stage
 * looks flat. The design does not use one shadow either — the prototype's
 * vocabulary runs from `0 1px 3px` on small chrome up to `0 6px 18px` on its
 * largest floating element.
 *
 * So the lift scales, between two anchors that both come from somewhere:
 *
 *   104px  `0 2px 8px rgba(0,0,0,.10)`   ORISO's own avatar, judged by eye
 *   320px  `0 6px 18px rgba(0,0,0,.16)`  the prototype's largest geometry,
 *                                        at the alpha it uses on light
 *                                        surfaces
 *
 * Nothing is extrapolated past either end. Below 104 the small value holds,
 * above 320 the large one does — an 800px shape does not want a 15px offset,
 * it wants the same lift as a 400px one.
 */

describe('liftFor', () => {
	it('is exactly the judged avatar value at and below 104px', () => {
		// Every existing screen in the app renders avatars in this range, and
		// none of them should change.
		expect(liftFor(104)).toBe(AVATAR_LIFT);
		expect(liftFor(64)).toBe(AVATAR_LIFT);
		expect(liftFor(24)).toBe(AVATAR_LIFT);
	});

	it("leaves the app's 108px default avatar visually where it was", () => {
		// 4px past the anchor: it must still round to the same shadow rather
		// than quietly restyling every profile in the product.
		expect(liftFor(108)).toBe(AVATAR_LIFT);
	});

	it("reaches the prototype's large geometry by 320px and stops there", () => {
		const large = '0 6px 18px 0 rgba(0, 0, 0, 0.16)';
		expect(liftFor(LIFT_MAX_AT)).toBe(large);
		expect(liftFor(600)).toBe(large);
		expect(liftFor(2000)).toBe(large);
	});

	it('grows in between, never shrinking as the shape gets bigger', () => {
		const offsets = [104, 150, 200, 250, 300, 320].map((size) =>
			Number(/^0 (\d+)px/.exec(liftFor(size))?.[1])
		);
		for (let i = 1; i < offsets.length; i += 1)
			expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1]);
		expect(offsets.at(-1)).toBeGreaterThan(offsets[0]);
	});

	it('emits whole pixels, so edges stay crisp', () => {
		for (const size of [104, 137, 211, 263, 319, 320])
			expect(liftFor(size)).toMatch(
				/^0 \d+px \d+px 0 rgba\(0, 0, 0, 0\.\d+\)$/
			);
	});

	it('survives a nonsense size instead of emitting NaN', () => {
		// A stage that has not measured itself yet passes 0.
		expect(liftFor(0)).toBe(AVATAR_LIFT);
		expect(liftFor(-10)).toBe(AVATAR_LIFT);
		expect(liftFor(Number.NaN)).toBe(AVATAR_LIFT);
	});
});
