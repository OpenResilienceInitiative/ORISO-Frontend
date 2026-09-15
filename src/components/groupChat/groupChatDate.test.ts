import { describe, expect, it } from 'vitest';
import { getGroupChatPlannedStart } from './groupChatDate';

describe('getGroupChatPlannedStart', () => {
	it('prefers the combined backend start instant', () => {
		expect(
			getGroupChatPlannedStart({
				startDateWithTime: '2026-08-04T18:00:00Z',
				startDate: 'wrong',
				startTime: 'wrong'
			})?.toISOString()
		).toBe('2026-08-04T18:00:00.000Z');
	});

	it('falls back to separate date and time fields', () => {
		expect(
			getGroupChatPlannedStart({
				startDate: '2026-08-04',
				startTime: '18:00:00Z'
			})?.toISOString()
		).toBe('2026-08-04T18:00:00.000Z');
	});

	it('returns null instead of exposing an invalid Date', () => {
		expect(
			getGroupChatPlannedStart({
				startDate: 'not-a-date',
				startTime: 'not-a-time'
			})
		).toBeNull();
	});

	it('accepts a full-ISO startDate by taking only its calendar-date part (#1293)', () => {
		// Contract example for startDate is a full datetime; concatenating it
		// raw with startTime used to yield Invalid Date → no countdown.
		// 12:05 in Europe/Berlin on 2019-10-23 (still CEST, UTC+2) → 10:05Z.
		expect(
			getGroupChatPlannedStart({
				startDate: '2019-10-23T00:00:00.000Z',
				startTime: '12:05',
				timezone: 'Europe/Berlin'
			})?.toISOString()
		).toBe('2019-10-23T10:05:00.000Z');
	});

	it('accepts a plain YYYY-MM-DD startDate with the group timezone', () => {
		expect(
			getGroupChatPlannedStart({
				startDate: '2019-10-23',
				startTime: '12:05',
				timezone: 'Europe/Berlin'
			})?.toISOString()
		).toBe('2019-10-23T10:05:00.000Z');
	});

	it('honours the group timezone even when the viewer is elsewhere', () => {
		// Same wall-clock as the Berlin cases above, but in America/New_York
		// (EDT, UTC-4) — proves we do not use the browser's local zone.
		expect(
			getGroupChatPlannedStart({
				startDate: '2019-10-23T00:00:00.000Z',
				startTime: '12:05',
				timezone: 'America/New_York'
			})?.toISOString()
		).toBe('2019-10-23T16:05:00.000Z');
	});

	it('follows DST: the same wall-clock time is +1 in winter, not +2', () => {
		expect(
			getGroupChatPlannedStart({
				startDate: '2020-01-15',
				startTime: '12:05',
				timezone: 'Europe/Berlin'
			})?.toISOString()
		).toBe('2020-01-15T11:05:00.000Z');
	});

	it('survives the spring-forward gap hour without returning Invalid Date', () => {
		// 02:30 on 2020-03-29 does not exist in Europe/Berlin; dayjs picks a side.
		const parsed = getGroupChatPlannedStart({
			startDate: '2020-03-29',
			startTime: '02:30',
			timezone: 'Europe/Berlin'
		});
		expect(parsed).not.toBeNull();
		expect(Number.isNaN(parsed!.getTime())).toBe(false);
	});

	it('still prefers startDateWithTime over date/time/timezone fallback', () => {
		expect(
			getGroupChatPlannedStart({
				startDateWithTime: '2026-08-04T18:00:00Z',
				startDate: '2019-10-23T00:00:00.000Z',
				startTime: '12:05',
				timezone: 'Europe/Berlin'
			})?.toISOString()
		).toBe('2026-08-04T18:00:00.000Z');
	});

	it('returns null for a still-invalid fallback after stripping the date', () => {
		expect(
			getGroupChatPlannedStart({
				startDate: 'garbageT00:00:00.000Z',
				startTime: '12:05',
				timezone: 'Europe/Berlin'
			})
		).toBeNull();
	});
});
