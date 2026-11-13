import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import {
	getGroupSeries,
	getGroupUpcomingDates,
	getGroupWaitingRoomSchedule,
	getGroupWaitingRoomTopic
} from './groupWaitingRoomData';

/** "10-27 18:00": the wall clock of `date` in `timeZone`. */
const wallClock = (date: Date, timeZone: string) => {
	const part = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(date)
			.map(({ type, value }) => [type, value])
	);
	return `${part.month}-${part.day} ${part.hour}:${part.minute}`;
};

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

	const projected = (
		start: string,
		occurrenceIndex: number,
		duration = 60
	) => ({
		seriesId: 15,
		occurrenceIndex,
		start,
		originalStart: start,
		duration,
		modality: 'TEXT' as const
	});
	const recurring = {
		startDateWithTime: '2026-11-10T20:59:00Z',
		chatInterval: 'WEEKLY',
		repeatCount: 3,
		duration: 60,
		timezone: 'Europe/Berlin'
	};

	it('offers only projected dates and never exports a recurrence across a skipped date', () => {
		const surviving = [
			projected(recurring.startDateWithTime, 0),
			projected('2026-11-24T20:59:00Z', 2)
		];
		const schedule = getGroupWaitingRoomSchedule(
			recurring,
			surviving,
			Date.parse('2026-11-09')
		);
		expect(schedule.upcomingDates).toEqual(
			surviving.map(({ start, duration }) => ({
				start: new Date(start),
				durationMinutes: duration
			}))
		);
		expect(schedule.series).toBeUndefined();
	});

	it('keeps an in-progress scheduled date until it ends and preserves an active clock anchor', () => {
		const next = projected('2026-11-17T20:59:00Z', 1);
		const running = projected(recurring.startDateWithTime, 0, 90);
		const now = Date.parse('2026-11-10T22:00:00Z');
		const schedule = getGroupWaitingRoomSchedule(
			recurring,
			[next, running],
			now
		);
		expect(schedule.plannedStart).toEqual(new Date(running.start));
		expect(schedule.durationMinutes).toBe(90);
		const active = getGroupWaitingRoomSchedule(
			{ ...recurring, active: true },
			[next],
			now
		);
		expect(active.plannedStart).toEqual(
			new Date(recurring.startDateWithTime)
		);
	});

	it('does not substitute legacy dates for an empty server projection', () => {
		const schedule = getGroupWaitingRoomSchedule(recurring, []);
		expect(schedule.plannedStart).toBeNull();
		expect(schedule.upcomingDates).toEqual([]);
		expect(schedule.series).toBeUndefined();
		expect(getGroupWaitingRoomSchedule(recurring).plannedStart).toEqual(
			new Date(recurring.startDateWithTime)
		);
	});

	it('ignores an earlier occurrence even when its original time window has not ended', () => {
		const next = '2026-11-17T20:59:00Z';
		const schedule = getGroupWaitingRoomSchedule(
			{
				...recurring,
				currentOccurrenceIndex: 1,
				startDateWithTime: next
			},
			[projected(recurring.startDateWithTime, 0, 90), projected(next, 1)],
			Date.parse('2026-11-10T21:30:00Z')
		);
		expect(schedule.plannedStart).toEqual(new Date(next));
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

	it('lists every date left of a weekly group and one for a single date', () => {
		const start = '2026-10-20T18:00:00Z';
		const weekly = getGroupUpcomingDates({
			startDateWithTime: start,
			chatInterval: 'WEEKLY',
			repeatCount: 10
		});
		// All ten, not a preview of three (Codex on #1782).
		expect(weekly).toHaveLength(10);
		// Calendar weeks: same local time, even across the DST change.
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
			chatInterval: 'DAILY',
			repeatCount: 3
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
			chatInterval: 'MONTHLY',
			repeatCount: 3
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

	it('steps every interval the group form offers', () => {
		const start = new Date(2026, 0, 6, 18, 0).toISOString();
		const steps = (chatInterval: string) =>
			getGroupUpcomingDates({
				startDateWithTime: start,
				chatInterval,
				repeatCount: 6
			})
				?.slice(0, 3)
				.map((date) => [
					date.getFullYear(),
					date.getMonth(),
					date.getDate()
				]);
		expect(steps('BIWEEKLY')).toEqual([
			[2026, 0, 6],
			[2026, 0, 20],
			[2026, 1, 3]
		]);
		expect(steps('QUARTERLY')).toEqual([
			[2026, 0, 6],
			[2026, 3, 6],
			[2026, 6, 6]
		]);
		expect(steps('YEARLY')).toEqual([
			[2026, 0, 6],
			[2027, 0, 6],
			[2028, 0, 6]
		]);
	});

	it('stops at the dates the series has left', () => {
		const chat = {
			startDateWithTime: '2026-10-20T16:00:00Z',
			chatInterval: 'WEEKLY',
			repeatCount: 6
		};
		// Index 4 of 0..5: this date and one more.
		expect(
			getGroupUpcomingDates({ ...chat, currentOccurrenceIndex: 4 })
		).toHaveLength(2);
		expect(getGroupSeries({ ...chat, currentOccurrenceIndex: 4 })).toEqual({
			repeat: 'WEEKLY',
			count: 2,
			timeZone: undefined
		});
		// The last date: no series left, nothing invented after it.
		expect(
			getGroupUpcomingDates({ ...chat, currentOccurrenceIndex: 5 })
		).toHaveLength(1);
		expect(getGroupSeries({ ...chat, currentOccurrenceIndex: 5 })).toBe(
			undefined
		);
		// No count on record: the UserService has no next date either.
		expect(
			getGroupUpcomingDates({ ...chat, repeatCount: undefined })
		).toHaveLength(1);
	});

	it("keeps the group's own wall clock across its DST change", () => {
		// 18:00 in New York, read from a runner in Berlin: the US change
		// (1 Nov 2026) is a week after the German one.
		const weekly = getGroupUpcomingDates({
			startDate: '2026-10-27',
			startTime: '18:00',
			timezone: 'America/New_York',
			chatInterval: 'WEEKLY',
			repeatCount: 3
		});
		expect(
			weekly?.map((date) => wallClock(date, 'America/New_York'))
		).toEqual(['10-27 18:00', '11-03 18:00', '11-10 18:00']);
	});
});
