import { describe, expect, it } from 'vite-plus/test';
import { freeForEveryone, freeGaps, nextFreeHours } from './calendarFreeTime';
import type { CalendarEntry } from './calendarModel';
import type { WorkingHours } from './calendarWorkingHours';

// Monday 16 November 2026.
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);
const iso = (day: number, h: number, m = 0) => at(day, h, m).toISOString();
const MON_FRI: WorkingHours = [1, 2, 3, 4, 5].map((weekday) => ({
	weekday,
	start: '08:00',
	end: '18:00'
}));
const entry = (
	id: string,
	ownerId: string,
	day: number,
	from: number,
	to: number
): CalendarEntry => ({
	id,
	type: 'appointment',
	kind: 'video',
	ownerId,
	start: iso(day, from),
	end: iso(day, to)
});

describe('calendarFreeTime', () => {
	it('finds the gaps between busy ranges inside the working day', () => {
		const gaps = freeGaps({
			busy: [
				{ start: at(17, 9), end: at(17, 10) },
				{ start: at(17, 12), end: at(17, 17, 45) }
			],
			day: at(17, 0),
			hours: MON_FRI,
			now: at(16, 9, 50)
		});
		expect(gaps).toEqual([
			{ start: at(17, 8), end: at(17, 9) },
			{ start: at(17, 10), end: at(17, 12) }
		]);
	});

	it('starts today at the next half hour', () => {
		const gaps = freeGaps({
			busy: [],
			day: at(16, 0),
			hours: MON_FRI,
			now: at(16, 9, 50)
		});
		expect(gaps[0].start).toEqual(at(16, 10));
	});

	it('has no free time on a day off and searches 8–18 without hours', () => {
		expect(
			freeGaps({
				busy: [],
				day: at(21, 0),
				hours: MON_FRI,
				now: at(16, 9)
			})
		).toEqual([]);
		expect(
			freeGaps({ busy: [], day: at(21, 0), hours: [], now: at(16, 9) })
		).toEqual([{ start: at(21, 8), end: at(21, 18) }]);
	});

	it('offers the first free hour of each of the next working days', () => {
		const entries = [
			entry('a', 'me', 16, 10, 11),
			entry('b', 'me', 16, 11, 14),
			entry('c', 'me', 17, 8, 9),
			entry('k', 'kaya', 18, 8, 18)
		];
		expect(
			nextFreeHours({
				entries,
				ownerId: 'me',
				hours: MON_FRI,
				now: at(16, 9, 50)
			})
		).toEqual([at(16, 14), at(17, 9), at(18, 8)]);
	});

	it('skips the weekend when it is not working time', () => {
		expect(
			nextFreeHours({
				entries: [],
				ownerId: 'me',
				hours: MON_FRI,
				now: at(20, 17, 30)
			})
		).toEqual([at(23, 8), at(24, 8), at(25, 8)]);
	});

	it('marks only the time in which everyone is free', () => {
		const entries = [
			entry('a', 'me', 16, 10, 11),
			entry('k', 'kaya', 16, 12, 13),
			entry('x', 'brandt', 16, 8, 17)
		];
		expect(
			freeForEveryone({
				entries,
				people: ['me', 'kaya'],
				day: at(16, 0),
				hours: MON_FRI,
				now: at(16, 7)
			})
		).toEqual([
			{ start: at(16, 8), end: at(16, 10) },
			{ start: at(16, 11), end: at(16, 12) },
			{ start: at(16, 13), end: at(16, 18) }
		]);
	});
});
