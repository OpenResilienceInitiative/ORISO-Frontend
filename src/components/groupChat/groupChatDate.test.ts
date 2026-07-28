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
});
