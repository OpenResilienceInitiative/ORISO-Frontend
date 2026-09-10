import { describe, expect, it } from 'vitest';
import {
	HEADER_COMPACT_WIDTH,
	HEADER_TITLE_MIN_SHARE,
	resolveRoomHeaderDensity,
	titleShareOf
} from './roomHeaderDensity';
import {
	STACK_MAX_VISIBLE,
	STACK_MAX_VISIBLE_PHONE
} from '../message/participantStack';

describe('resolveRoomHeaderDensity (Frank 09.09.2026, finding *1)', () => {
	it('leaves a roomy pane exactly as it is today', () => {
		const density = resolveRoomHeaderDensity({ width: 840 });
		expect(density.compact).toBe(false);
		expect(density.callsInMenu).toBe(false);
		expect(density.stackMaxVisible).toBe(STACK_MAX_VISIBLE);
	});

	/**
	 * Measured on the running stage (1280 × 820, story (d)): with the calls
	 * inline the main header spends 136 px on the type pill + avatar stack
	 * and 134 px on the menu, so the title column is `pane − 302`. D8's own
	 * rule — the title keeps at least 40 % of the row — breaks at 482 px;
	 * at 480 px the name is the first thing to be clipped (9 px). Hence the
	 * threshold.
	 */
	it('moves the calls into the kebab as soon as the title would fall under 40 % of the row', () => {
		expect(HEADER_COMPACT_WIDTH).toBe(480);
		expect(HEADER_TITLE_MIN_SHARE).toBe(0.4);
		const density = resolveRoomHeaderDensity({
			width: HEADER_COMPACT_WIDTH - 1
		});
		expect(density.compact).toBe(true);
		expect(density.callsInMenu).toBe(true);
		expect(density.stackMaxVisible).toBe(STACK_MAX_VISIBLE_PHONE);
	});

	it('is compact all the way down to the 320 px drag floor', () => {
		const density = resolveRoomHeaderDensity({ width: 320 });
		expect(density.compact).toBe(true);
		expect(density.callsInMenu).toBe(true);
		expect(density.stackMaxVisible).toBe(STACK_MAX_VISIBLE_PHONE);
	});

	it('keeps the phone compact whatever its width reports (T4/D8)', () => {
		const density = resolveRoomHeaderDensity({ width: 900, phone: true });
		expect(density.compact).toBe(true);
		expect(density.callsInMenu).toBe(true);
		expect(density.stackMaxVisible).toBe(STACK_MAX_VISIBLE_PHONE);
	});

	it('waits for the first measurement instead of guessing compact', () => {
		const density = resolveRoomHeaderDensity({ width: null });
		expect(density.compact).toBe(false);
		expect(density.stackMaxVisible).toBe(STACK_MAX_VISIBLE);
		expect(resolveRoomHeaderDensity({ width: 0 }).compact).toBe(false);
		expect(resolveRoomHeaderDensity({ width: NaN }).compact).toBe(false);
	});

	it('titleShareOf reports what is left of the row for the name', () => {
		// 840 px pane: 32 px header inset, 136 px stack, 134 px menu.
		expect(titleShareOf({ rowWidth: 808, chromeWidth: 270 })).toBeCloseTo(
			(808 - 270) / 808,
			5
		);
		expect(titleShareOf({ rowWidth: 0, chromeWidth: 270 })).toBe(0);
	});
});
