import { describe, expect, it } from 'vitest';
import { overflowEdges, wheelToHorizontal } from './scrollableBar';

/**
 * Review v6 (T22): the icon bar scrolls sideways without a scrollbar. The
 * edges say where a fade belongs; the wheel rule turns a mouse's vertical
 * wheel into sideways travel so desktop mouse users reach the last icon.
 */
describe('overflowEdges', () => {
	it('reports nothing hidden when the bar fits', () => {
		expect(
			overflowEdges({ scrollLeft: 0, scrollWidth: 280, clientWidth: 280 })
		).toEqual({ start: false, end: false });
	});

	it('hides content at the end when scrolled to the start', () => {
		expect(
			overflowEdges({ scrollLeft: 0, scrollWidth: 330, clientWidth: 280 })
		).toEqual({ start: false, end: true });
	});

	it('hides content at both ends in the middle', () => {
		expect(
			overflowEdges({
				scrollLeft: 20,
				scrollWidth: 330,
				clientWidth: 280
			})
		).toEqual({ start: true, end: true });
	});

	it('hides content at the start when scrolled to the end (sub-pixel tolerant)', () => {
		expect(
			overflowEdges({
				scrollLeft: 49.6,
				scrollWidth: 330,
				clientWidth: 280
			})
		).toEqual({ start: true, end: false });
	});
});

describe('wheelToHorizontal', () => {
	it('turns a vertical wheel into sideways travel', () => {
		expect(wheelToHorizontal({ deltaX: 0, deltaY: 100 })).toBe(100);
		expect(wheelToHorizontal({ deltaX: 0, deltaY: -40 })).toBe(-40);
	});

	it('leaves a sideways gesture (trackpad, Shift+wheel) to the browser', () => {
		expect(wheelToHorizontal({ deltaX: 30, deltaY: 0 })).toBeNull();
		expect(wheelToHorizontal({ deltaX: 30, deltaY: 5 })).toBeNull();
		expect(
			wheelToHorizontal({ deltaX: 0, deltaY: 100, shiftKey: true })
		).toBeNull();
	});

	it('does nothing for a wheel without vertical travel', () => {
		expect(wheelToHorizontal({ deltaX: 0, deltaY: 0 })).toBeNull();
	});

	it('scales line-based deltas (Firefox) to pixels', () => {
		expect(wheelToHorizontal({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe(
			48
		);
	});
});
