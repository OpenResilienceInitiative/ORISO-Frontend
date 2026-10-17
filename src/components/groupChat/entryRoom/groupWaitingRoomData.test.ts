import { describe, expect, it } from 'vitest';
import {
	getGroupUpcomingDates,
	getGroupWaitingRoomTopic
} from './groupWaitingRoomData';

describe('groupWaitingRoomData', () => {
	it('keeps the topic out until the privacy agreement is on record', () => {
		const chat = { topic: { name: 'Trauer' } };
		expect(getGroupWaitingRoomTopic(chat, null)).toBeUndefined();
		expect(getGroupWaitingRoomTopic(chat, '  ')).toBeUndefined();
		expect(getGroupWaitingRoomTopic(chat, '2026-10-17')).toBe('Trauer');
		expect(getGroupWaitingRoomTopic({ topic: 'Sucht' }, '2026-10-17')).toBe(
			'Sucht'
		);
	});

	it('lists three dates for a weekly group and one for a single date', () => {
		const start = '2026-10-20T18:00:00Z';
		const weekly = getGroupUpcomingDates({
			startDateWithTime: start,
			chatInterval: 'WEEKLY'
		});
		// Calendar weeks: same local time, even across the DST change.
		expect(weekly).toHaveLength(3);
		const first = new Date(start);
		weekly?.forEach((date, step) => {
			expect(date.getHours()).toBe(first.getHours());
			expect(date.getDate()).toBe(
				new Date(
					first.getFullYear(),
					first.getMonth(),
					first.getDate() + 7 * step
				).getDate()
			);
		});
		expect(
			getGroupUpcomingDates({ startDateWithTime: start })
		).toHaveLength(1);
		expect(getGroupUpcomingDates({})).toBeUndefined();
	});
});
