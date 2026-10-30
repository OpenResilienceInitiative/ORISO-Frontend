import { describe, expect, it } from 'vite-plus/test';
import { entryMenuPosition } from './AppointmentSplitButton';

const anchor = (top: number, right = 400) =>
	({ top, bottom: top + 40, right }) as DOMRect;
const viewport = { width: 1440, height: 900 };

describe('entryMenuPosition', () => {
	it('opens below the arrow when the menu fits there', () => {
		expect(entryMenuPosition(anchor(100), 380, viewport)).toEqual({
			top: 148,
			left: 80
		});
	});

	it('opens above the arrow when it would leave the window below', () => {
		// Measured on Dev: arrow at 623, menu 382 high, window 900.
		expect(entryMenuPosition(anchor(623), 382, viewport).top).toBe(233);
	});

	it('stays below when it fits neither way but has more room there', () => {
		expect(entryMenuPosition(anchor(300), 800, viewport).top).toBe(348);
	});

	it('keeps the menu inside the window horizontally', () => {
		expect(entryMenuPosition(anchor(100, 200), 300, viewport).left).toBe(8);
		expect(entryMenuPosition(anchor(100, 2000), 300, viewport).left).toBe(
			1112
		);
	});
});
