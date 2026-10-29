import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	getGroupUpcomingDates,
	getGroupWaitingRoomTopic
} from './groupWaitingRoomData';

describe('groupWaitingRoomData', () => {
	/* A zone with a DST change (25 Oct 2026), so the calendar steps are
	   checked across it whatever zone the runner uses. */
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});

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

	it('steps a daily group at the same local time across the DST change', () => {
		const start = new Date(2026, 9, 24, 18, 0);
		const daily = getGroupUpcomingDates({
			startDateWithTime: start.toISOString(),
			chatInterval: 'DAILY'
		});
		expect(daily?.map((date) => [date.getDate(), date.getHours()])).toEqual(
			[
				[24, 18],
				[25, 18],
				[26, 18]
			]
		);
	});

	it('steps a monthly group by calendar month, not by 30 days', () => {
		const monthly = getGroupUpcomingDates({
			startDateWithTime: new Date(2027, 0, 31, 18, 0).toISOString(),
			chatInterval: 'MONTHLY'
		});
		// Clamped to the end of February, never 2 or 3 March.
		expect(
			monthly?.map((date) => [date.getMonth(), date.getDate()])
		).toEqual([
			[0, 31],
			[1, 28],
			[2, 31]
		]);
	});
});
