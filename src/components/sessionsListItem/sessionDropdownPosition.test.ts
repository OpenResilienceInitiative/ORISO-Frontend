import { describe, expect, it } from 'vitest';
import { getSessionDropdownPosition } from './sessionDropdownPosition';

describe('getSessionDropdownPosition', () => {
	it('aligns the menu to the right side of its trigger on wide viewports', () => {
		expect(
			getSessionDropdownPosition({ bottom: 120, right: 520 }, 1024)
		).toEqual({ top: 128, left: 219 });
	});

	it('keeps the menu inside the right viewport edge', () => {
		expect(
			getSessionDropdownPosition({ bottom: 64, right: 420 }, 360)
		).toEqual({ top: 72, left: 47 });
	});

	it('keeps the menu inside the left viewport edge on very narrow viewports', () => {
		expect(
			getSessionDropdownPosition({ bottom: 64, right: 120 }, 280)
		).toEqual({ top: 72, left: 12 });
	});
});
