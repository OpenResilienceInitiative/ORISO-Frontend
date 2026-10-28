import { describe, expect, it } from 'vite-plus/test';
import { fitRunningWall, runningWallWidth } from './GroupRunningNow';

describe('fitRunningWall', () => {
	it('picks the largest clock whose row still fits', () => {
		for (const width of [320, 480, 760]) {
			const size = fitRunningWall(width, [2, 2, 2]);
			expect(runningWallWidth(size, [2, 2, 2])).toBeLessThanOrEqual(
				width
			);
			expect(runningWallWidth(size + 1, [2, 2, 2])).toBeGreaterThan(
				width
			);
		}
	});

	it('stops at the cap on a wide column', () => {
		expect(fitRunningWall(4000, [2, 2, 2])).toBe(32);
	});

	it('makes room for a third hour digit', () => {
		expect(fitRunningWall(760, [3, 2, 2])).toBeLessThan(
			fitRunningWall(760, [2, 2, 2])
		);
	});
});
