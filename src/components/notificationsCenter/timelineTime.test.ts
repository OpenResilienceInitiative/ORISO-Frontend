import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	formatAbsoluteTime,
	formatClockParts,
	formatRelativeTime
} from './timelineTime';

describe('timeline time formatting (#845)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-01T17:12:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders German relative times for the German UI', () => {
		expect(formatRelativeTime('2026-08-01T17:11:40Z', 'de')).toBe('jetzt');
		expect(formatRelativeTime('2026-08-01T17:07:00Z', 'de')).toContain(
			'5 Min.'
		);
		expect(formatRelativeTime('2026-08-01T12:12:00Z', 'de')).toContain(
			'5 Std.'
		);
	});

	it('renders English relative times for the English UI', () => {
		expect(formatRelativeTime('2026-08-01T12:12:00Z', 'en')).toMatch(
			/5 hr\.? ago/
		);
	});

	it('falls back to a locale date beyond seven days', () => {
		expect(formatRelativeTime('2026-07-01T12:00:00Z', 'de')).toBe(
			'01.07.2026'
		);
	});

	it('treats naive server timestamps as UTC', () => {
		// no zone suffix: same instant as 12:12:00Z
		expect(formatRelativeTime('2026-08-01T12:12:00', 'de')).toContain(
			'5 Std.'
		);
	});

	it('returns an empty string for garbage input', () => {
		expect(formatRelativeTime('not-a-date', 'de')).toBe('');
		expect(formatAbsoluteTime('not-a-date', 'de')).toBe('');
	});

	it('formats the absolute detail timestamp in the active locale', () => {
		const value = formatAbsoluteTime('2026-08-01T14:48:00Z', 'de');
		expect(value).toContain('01.08.2026');
		// hour depends on the host timezone — assert the shape only
		expect(value).toMatch(/\d{2}:\d{2}/);
	});

	it('splits clock parts for the waiting-since interpolation', () => {
		const parts = formatClockParts('2026-08-01T14:48:00Z', 'de');
		expect(parts.time).toMatch(/\d{2}:\d{2}/);
		expect(parts.date).toMatch(/\d{2}\.\d{2}\./);
	});
});
