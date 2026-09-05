import { describe, expect, it } from 'vitest';
import {
	HOLD_TO_COLLAPSE_MS,
	HOLD_TOLERANCE_PX,
	isHoldGesture
} from './resizableHandleMath';

/**
 * T5 / Frank (*****): "drag/halten macht das Einklappen" — pressing the
 * handle and holding still toggles the list; moving turns it into a drag.
 */
describe('press-and-hold collapse (T5)', () => {
	it('holds for 450 ms within a 4 px tolerance', () => {
		expect(HOLD_TO_COLLAPSE_MS).toBe(450);
		expect(HOLD_TOLERANCE_PX).toBe(4);
	});

	it('is a hold when the pointer stayed put', () => {
		expect(isHoldGesture({ movedPx: 0 })).toBe(true);
		expect(isHoldGesture({ movedPx: 3.9 })).toBe(true);
	});

	it('is a drag once the pointer moved beyond the tolerance', () => {
		expect(isHoldGesture({ movedPx: 4 })).toBe(false);
		expect(isHoldGesture({ movedPx: 40 })).toBe(false);
	});
});
