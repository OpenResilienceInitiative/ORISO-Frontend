import { describe, expect, it } from 'vitest';
import { chipRevealScrollLeft } from './chipRowReveal';

describe('chipRevealScrollLeft', () => {
	it('leaves a fully visible chip alone', () => {
		expect(chipRevealScrollLeft(0, 300, 40, 120)).toBeNull();
	});

	it('scrolls right so a chip cut off at the right edge ends inside the gutter', () => {
		// Supervision chip at 460–600 in a 520px row (Frank's screenshot).
		expect(chipRevealScrollLeft(0, 520, 460, 600)).toBe(600 + 12 - 520);
	});

	it('scrolls left for a chip hidden at the left edge, never below 0', () => {
		expect(chipRevealScrollLeft(200, 300, 150, 230)).toBe(138);
		expect(chipRevealScrollLeft(50, 300, 4, 60)).toBe(0);
	});

	it('drops the gutter when chip plus both gutters do not fit, so the chip is never clipped', () => {
		// 290px chip in a 300px row: 12px on both sides cannot fit.
		const target = chipRevealScrollLeft(0, 300, 400, 690)!;
		expect(target).toBeLessThanOrEqual(400);
		expect(target + 300).toBeGreaterThanOrEqual(690);
		// Same from the left edge.
		const back = chipRevealScrollLeft(500, 300, 100, 390)!;
		expect(back).toBeLessThanOrEqual(100);
		expect(back + 300).toBeGreaterThanOrEqual(390);
	});
});
