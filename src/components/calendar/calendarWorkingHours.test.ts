import { describe, expect, it } from 'vite-plus/test';
import {
	DEFAULT_BREAK,
	breakOf,
	businessHoursOf,
	groupWorkingHours,
	invalidRows,
	isBreakValid,
	isWithinWorkingHours,
	rowsToWorkingHours,
	workingHoursFromApi,
	workingHoursToApi,
	workingHoursToRows,
	type WorkingHours
} from './calendarWorkingHours';

const MON_FRI: WorkingHours = [1, 2, 3, 4, 5].map((weekday) => ({
	weekday,
	start: '08:00',
	end: '18:00'
}));

describe('calendarWorkingHours', () => {
	it('reads the windows sorted and drops malformed ones', () => {
		expect(
			workingHoursFromApi({
				windows: [
					{ weekday: 3, start: '09:00', end: '12:00' },
					{ weekday: 1, start: '13:00', end: '17:00' },
					{ weekday: 1, start: '08:00', end: '12:00' },
					{ weekday: 7, start: '08:00', end: '12:00' },
					{ weekday: 2, start: '8:00', end: '12:00' },
					{ weekday: 4, start: '12:00', end: '11:00' }
				]
			})
		).toEqual([
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '17:00' },
			{ weekday: 3, start: '09:00', end: '12:00' }
		]);
	});

	it('treats a missing body or list as no working hours', () => {
		expect(workingHoursFromApi(undefined)).toEqual([]);
		expect(workingHoursFromApi({})).toEqual([]);
	});

	it('writes the body UserService expects, Sunday numbered 0', () => {
		expect(
			workingHoursToApi([
				{ weekday: 0, start: '10:00', end: '12:00' },
				{ weekday: 6, start: '10:00', end: '12:00' }
			])
		).toEqual({
			windows: [
				{ weekday: 0, start: '10:00', end: '12:00' },
				{ weekday: 6, start: '10:00', end: '12:00' }
			]
		});
		expect(workingHoursToApi([])).toEqual({ windows: [] });
	});

	it('maps to FullCalendar business hours, or none', () => {
		expect(businessHoursOf([])).toBe(false);
		expect(
			businessHoursOf([{ weekday: 1, start: '08:00', end: '18:00' }])
		).toEqual([{ daysOfWeek: [1], startTime: '08:00', endTime: '18:00' }]);
	});

	it('knows whether a range lies inside the hours', () => {
		// 16 November 2026 is a Monday, the 21st a Saturday.
		const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
		expect(isWithinWorkingHours(at(16, 9), at(16, 10), MON_FRI)).toBe(true);
		expect(isWithinWorkingHours(at(16, 17), at(16, 18), MON_FRI)).toBe(
			true
		);
		expect(isWithinWorkingHours(at(16, 17), at(16, 19), MON_FRI)).toBe(
			false
		);
		expect(isWithinWorkingHours(at(21, 9), at(21, 10), MON_FRI)).toBe(
			false
		);
		expect(isWithinWorkingHours(at(21, 9), at(21, 10), [])).toBe(true);
	});

	it('turns hours into one dialog row per weekday, Monday first', () => {
		const rows = workingHoursToRows(MON_FRI);
		expect(rows.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(rows.filter((r) => r.enabled)).toHaveLength(5);
		expect(rows[5]).toEqual({
			weekday: 6,
			enabled: false,
			start: '08:00',
			end: '18:00'
		});
	});

	it('spans two windows of one day in its row', () => {
		const rows = workingHoursToRows([
			{ weekday: 2, start: '08:00', end: '12:00' },
			{ weekday: 2, start: '13:00', end: '17:30' }
		]);
		expect(rows[1]).toEqual({
			weekday: 2,
			enabled: true,
			start: '08:00',
			end: '17:30'
		});
	});

	it('turns the rows back into windows and flags reversed times', () => {
		const rows = workingHoursToRows(MON_FRI);
		rows[0] = { ...rows[0], end: '07:00' };
		expect(invalidRows(rows)).toEqual([1]);
		expect(rowsToWorkingHours(rows).map((w) => w.weekday)).toEqual([
			2, 3, 4, 5
		]);
	});

	it('groups equal days for the summary line', () => {
		expect(groupWorkingHours(MON_FRI)).toEqual([
			{
				weekdays: [1, 2, 3, 4, 5],
				start: '08:00',
				end: '18:00',
				contiguous: true
			}
		]);
		expect(
			groupWorkingHours([
				{ weekday: 1, start: '08:00', end: '12:00' },
				{ weekday: 3, start: '08:00', end: '12:00' }
			])[0].contiguous
		).toBe(false);
	});
});

describe('lunch break', () => {
	const week = (from: string, to: string, gap?: [string, string]) =>
		[1, 2, 3, 4, 5].flatMap((weekday) =>
			gap
				? [
						{ weekday, start: from, end: gap[0] },
						{ weekday, start: gap[1], end: to }
					]
				: [{ weekday, start: from, end: to }]
		);

	it('is on at 12:00–13:00 before any hours are set', () => {
		expect(breakOf([])).toEqual(DEFAULT_BREAK);
	});

	it('reads a break that splits every working day the same way', () => {
		expect(breakOf(week('08:00', '17:00', ['12:30', '13:15']))).toEqual({
			enabled: true,
			start: '12:30',
			end: '13:15'
		});
		expect(breakOf(week('08:00', '17:00')).enabled).toBe(false);
		const uneven = week('08:00', '17:00', ['12:00', '13:00']);
		uneven[1] = { weekday: 1, start: '13:30', end: '17:00' };
		expect(breakOf(uneven).enabled).toBe(false);
	});

	it('splits only the days that span the break', () => {
		const rows = workingHoursToRows([
			{ weekday: 1, start: '08:00', end: '17:00' },
			{ weekday: 5, start: '08:00', end: '12:00' }
		]);
		expect(rowsToWorkingHours(rows, DEFAULT_BREAK)).toEqual([
			{ weekday: 1, start: '08:00', end: '12:00' },
			{ weekday: 1, start: '13:00', end: '17:00' },
			{ weekday: 5, start: '08:00', end: '12:00' }
		]);
		expect(
			rowsToWorkingHours(rows, { ...DEFAULT_BREAK, enabled: false })
		).toHaveLength(2);
	});

	it('round-trips a week with a break through the dialog rows', () => {
		const stored = week('08:00', '18:00', ['12:00', '13:00']);
		expect(
			rowsToWorkingHours(workingHoursToRows(stored), breakOf(stored))
		).toEqual(stored.sort((a, b) => a.weekday - b.weekday));
		expect(
			isBreakValid({ enabled: true, start: '13:00', end: '12:00' })
		).toBe(false);
	});
});
