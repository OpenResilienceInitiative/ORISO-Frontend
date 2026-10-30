import { describe, expect, it } from 'vite-plus/test';
import {
	clampReveal,
	heightFromPointerY,
	nearestSnap,
	revealSnapPoints,
	rubberBand,
	RUBBER_BAND_MAX_PX,
	stepSnap
} from './verticalHandleMath';

describe('vertical handle math', () => {
	it('reads the height from the pointer, handle on the bottom edge', () => {
		expect(heightFromPointerY(340, 100)).toBe(240);
	});

	it('clamps to the content', () => {
		expect(clampReveal(-5, 300)).toBe(0);
		expect(clampReveal(900, 300)).toBe(300);
	});

	it('stretches past the last item, but never far', () => {
		expect(rubberBand(200, 300)).toBe(200);
		expect(rubberBand(340, 300)).toBe(310);
		expect(rubberBand(5000, 300)).toBe(300 + RUBBER_BAND_MAX_PX);
		expect(rubberBand(-20, 300)).toBe(0);
	});

	it('offers closed / next / half / almost-all, capped by the content', () => {
		expect(
			revealSnapPoints({
				itemHeight: 140,
				listHeight: 800,
				contentHeight: 1500
			})
		).toEqual([0, 140, 400, 680, 1500]);
	});

	it('ends right after a single appointment', () => {
		expect(
			revealSnapPoints({
				itemHeight: 140,
				listHeight: 800,
				contentHeight: 140
			})
		).toEqual([0, 140]);
	});

	it('has only the closed stop when there is nothing planned', () => {
		expect(
			revealSnapPoints({
				itemHeight: 140,
				listHeight: 800,
				contentHeight: 0
			})
		).toEqual([0]);
	});

	it('snaps a drag to the nearest stop', () => {
		const points = [0, 140, 400, 680];
		expect(nearestSnap(60, points)).toBe(0);
		expect(nearestSnap(100, points)).toBe(140);
		expect(nearestSnap(560, points)).toBe(680);
	});

	it('steps through the stops from the keyboard', () => {
		const points = [0, 140, 400];
		expect(stepSnap(0, points, 1)).toBe(140);
		expect(stepSnap(140, points, 1)).toBe(400);
		expect(stepSnap(400, points, 1)).toBe(400);
		expect(stepSnap(140, points, -1)).toBe(0);
		expect(stepSnap(0, points, -1)).toBe(0);
	});
});
