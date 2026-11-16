// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test';
import {
	GRID_SLOT_PX,
	SPLIT_SLOT_PX,
	ZOOM_MAX,
	ZOOM_MIN,
	anchoredScrollTop,
	clampZoom,
	zoomStep
} from './calendarZoom';

describe('calendar zoom', () => {
	it("steps from today's height through 18/22/30/40/56/76/96", () => {
		expect(zoomStep(GRID_SLOT_PX, 1)).toBe(30);
		expect(zoomStep(GRID_SLOT_PX, -1)).toBe(22);
		expect(zoomStep(SPLIT_SLOT_PX, 1)).toBe(30);
		expect(zoomStep(SPLIT_SLOT_PX, -1)).toBe(22);
		expect(zoomStep(30, 1)).toBe(40);
		expect(zoomStep(76, 1)).toBe(96);
		expect(zoomStep(22, -1)).toBe(18);
		// A pinch leaves odd heights; the buttons go on to the next step.
		expect(zoomStep(53.9, 1)).toBe(56);
		expect(zoomStep(53.9, -1)).toBe(40);
	});

	it('stops at 18 and 96 pixels per half hour', () => {
		expect(zoomStep(ZOOM_MIN, -1)).toBe(18);
		expect(zoomStep(ZOOM_MAX, 1)).toBe(96);
		expect(clampZoom(4)).toBe(18);
		expect(clampZoom(400)).toBe(96);
		expect(clampZoom(33.333)).toBe(33.3);
	});

	it('keeps the time under the pointer in place', () => {
		// 25 px per half hour, scrolled by 50, pointer 300 px down: the
		// pointer sits at half hour 14. At 40 px that is 560 into the
		// time, so the scroll goes to 260.
		expect(
			anchoredScrollTop({ scrollTop: 50, y: 300, from: 25, to: 40 })
		).toBe(260);
		// The time starting 73 px into the scrolled content (the heads of
		// "Nebeneinander").
		expect(
			anchoredScrollTop({
				scrollTop: 261,
				y: 322,
				bodyTop: 73,
				from: 40,
				to: 30
			})
		).toBeCloseTo(133.5);
		// Never above the top.
		expect(
			anchoredScrollTop({ scrollTop: 0, y: 10, from: 40, to: 18 })
		).toBe(0);
	});
});
