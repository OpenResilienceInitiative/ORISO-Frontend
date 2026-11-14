import { describe, expect, it } from 'vite-plus/test';
import {
	DEFAULT_VALIDITY_MINUTES,
	MAX_VALIDITY_MINUTES,
	VALIDITY_OPTIONS,
	stepValidity,
	validityParts
} from './invitationValidity';

describe('invitation validity after the appointment ends (#2252)', () => {
	it('defaults to 24 hours and ends at 48 hours', () => {
		expect(DEFAULT_VALIDITY_MINUTES).toBe(1440);
		expect(MAX_VALIDITY_MINUTES).toBe(2880);
	});

	it('steps in minutes below one hour and in hours above', () => {
		expect(VALIDITY_OPTIONS.slice(0, 6)).toEqual([0, 15, 30, 45, 60, 120]);
		expect(VALIDITY_OPTIONS[VALIDITY_OPTIONS.length - 1]).toBe(2880);
		expect(VALIDITY_OPTIONS).toHaveLength(52);
	});

	it.each([
		[0, 'up', 15],
		[45, 'up', 60],
		[60, 'up', 120],
		[1440, 'up', 1500],
		[1440, 'down', 1380],
		[120, 'down', 60],
		[60, 'down', 45],
		[15, 'down', 0]
	] as const)('%i minutes stepped %s gives %i', (from, direction, to) => {
		expect(stepValidity(from, direction)).toBe(to);
	});

	it('stops at both ends instead of wrapping', () => {
		expect(stepValidity(0, 'down')).toBe(0);
		expect(stepValidity(2880, 'up')).toBe(2880);
	});

	it('snaps an off-grid value to the next option in the step direction', () => {
		expect(stepValidity(20, 'up')).toBe(30);
		expect(stepValidity(20, 'down')).toBe(15);
		expect(stepValidity(90, 'up')).toBe(120);
		expect(stepValidity(90, 'down')).toBe(60);
		expect(stepValidity(5000, 'down')).toBe(2880);
	});

	it.each([
		[0, { unit: 'end', count: 0 }],
		[30, { unit: 'minutes', count: 30 }],
		[60, { unit: 'hours', count: 1 }],
		[1440, { unit: 'hours', count: 24 }]
	] as const)('describes %i minutes for the label', (minutes, parts) => {
		expect(validityParts(minutes)).toEqual(parts);
	});
});
