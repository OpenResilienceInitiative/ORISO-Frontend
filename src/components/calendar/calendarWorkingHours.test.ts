import { describe, expect, it } from 'vite-plus/test';
import {
	businessHoursOf,
	groupWorkingHours,
	invalidRows,
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
