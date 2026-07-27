import { describe, expect, it } from 'vitest';
import { computeDndUntil } from './dndHelpers';

describe('computeDndUntil', () => {
	const now = new Date('2026-07-18T10:00:00.000Z');

	it('off → null', () => {
		expect(computeDndUntil('off', now)).toBeNull();
	});

	it('1h → one hour from now', () => {
		expect(computeDndUntil('1h', now)).toBe('2026-07-18T11:00:00.000Z');
	});

	it('8h → eight hours from now', () => {
		expect(computeDndUntil('8h', now)).toBe('2026-07-18T18:00:00.000Z');
	});

	it('tomorrow → next day at 08:00 local time', () => {
		const result = computeDndUntil('tomorrow', now);
		const parsed = new Date(result as string);
		expect(parsed.getDate()).toBe(19);
		expect(parsed.getHours()).toBe(8);
		expect(parsed.getMinutes()).toBe(0);
	});
});
