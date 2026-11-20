import { describe, expect, it } from 'vite-plus/test';
import {
	HOLIDAY_REGIONS,
	dateKeyOf,
	easterSunday,
	holidayOn,
	isHolidayRegion,
	nextHoliday,
	publicHolidays
} from './calendarHolidays';

const dates = (year: number, region: Parameters<typeof publicHolidays>[1]) =>
	publicHolidays(year, region).map((h) => h.date);

describe('calendarHolidays', () => {
	it('computes Easter Sunday with the anonymous Gregorian algorithm', () => {
		expect(dateKeyOf(easterSunday(2019))).toBe('2019-04-21');
		expect(dateKeyOf(easterSunday(2024))).toBe('2024-03-31');
		expect(dateKeyOf(easterSunday(2025))).toBe('2025-04-20');
		expect(dateKeyOf(easterSunday(2026))).toBe('2026-04-05');
		expect(dateKeyOf(easterSunday(2027))).toBe('2027-03-28');
		expect(dateKeyOf(easterSunday(2038))).toBe('2038-04-25');
		// The earliest and latest possible dates.
		expect(dateKeyOf(easterSunday(2285))).toBe('2285-03-22');
		expect(dateKeyOf(easterSunday(1943))).toBe('1943-04-25');
	});

	it('knows the sixteen Länder of the contract', () => {
		expect(HOLIDAY_REGIONS).toHaveLength(16);
		expect(isHolidayRegion('NW')).toBe(true);
		expect(isHolidayRegion('NRW')).toBe(false);
		expect(isHolidayRegion(null)).toBe(false);
	});

	it('lists Nordrhein-Westfalen 2026', () => {
		expect(dates(2026, 'NW')).toEqual([
			'2026-01-01',
			'2026-04-03',
			'2026-04-06',
			'2026-05-01',
			'2026-05-14',
			'2026-05-25',
			'2026-06-04',
			'2026-10-03',
			'2026-11-01',
			'2026-12-25',
			'2026-12-26'
		]);
	});

	it('lists Bayern 2026 with Heilige Drei Könige, without Mariä Himmelfahrt', () => {
		const list = publicHolidays(2026, 'BY');
		expect(list.map((h) => h.date)).toEqual([
			'2026-01-01',
			'2026-01-06',
			'2026-04-03',
			'2026-04-06',
			'2026-05-01',
			'2026-05-14',
			'2026-05-25',
			'2026-06-04',
			'2026-10-03',
			'2026-11-01',
			'2026-12-25',
			'2026-12-26'
		]);
		expect(list[1].name).toBe('Heilige Drei Könige');
	});

	it('gives Sachsen Reformationstag and Buß- und Bettag', () => {
		const list = publicHolidays(2026, 'SN');
		expect(list).toContainEqual({
			date: '2026-11-18',
			key: 'repentanceDay',
			name: 'Buß- und Bettag'
		});
		expect(dates(2026, 'SN')).toContain('2026-10-31');
		expect(dates(2026, 'SN')).not.toContain('2026-06-04');
		expect(dates(2027, 'SN')).toContain('2027-11-17');
		expect(dates(2026, 'NW')).not.toContain('2026-11-18');
	});

	it('moves the Easter holidays with Easter (2027)', () => {
		expect(dates(2027, 'BW')).toEqual([
			'2027-01-01',
			'2027-01-06',
			'2027-03-26',
			'2027-03-29',
			'2027-05-01',
			'2027-05-06',
			'2027-05-17',
			'2027-05-27',
			'2027-10-03',
			'2027-11-01',
			'2027-12-25',
			'2027-12-26'
		]);
	});

	it('has the Land-only days', () => {
		expect(dates(2026, 'BE')).toContain('2026-03-08');
		expect(dates(2026, 'MV')).toContain('2026-03-08');
		expect(dates(2022, 'MV')).not.toContain('2022-03-08');
		expect(dates(2026, 'TH')).toContain('2026-09-20');
		expect(dates(2026, 'TH')).toContain('2026-10-31');
		expect(dates(2026, 'SL')).toContain('2026-08-15');
		expect(dates(2026, 'SL')).toContain('2026-06-04');
		expect(dates(2026, 'ST')).toContain('2026-01-06');
		expect(dates(2026, 'BB')).toEqual(
			expect.arrayContaining(['2026-04-05', '2026-05-24', '2026-10-31'])
		);
		expect(dates(2027, 'HE')).toEqual(
			expect.arrayContaining(['2027-03-28', '2027-05-16', '2027-05-27'])
		);
		expect(dates(2026, 'HH')).toContain('2026-10-31');
		expect(dates(2017, 'HH')).not.toContain('2017-10-31');
	});

	it('gives every Land the nine nationwide holidays', () => {
		for (const region of HOLIDAY_REGIONS)
			expect(dates(2026, region)).toEqual(
				expect.arrayContaining([
					'2026-01-01',
					'2026-04-03',
					'2026-04-06',
					'2026-05-01',
					'2026-05-14',
					'2026-05-25',
					'2026-10-03',
					'2026-12-25',
					'2026-12-26'
				])
			);
	});

	it('finds the holiday on a day and the next one', () => {
		expect(holidayOn(new Date(2026, 10, 18, 9), 'SN')?.key).toBe(
			'repentanceDay'
		);
		expect(holidayOn(new Date(2026, 10, 18), 'NW')).toBeUndefined();
		expect(holidayOn(new Date(2026, 11, 25), null)).toBeUndefined();
		expect(nextHoliday(new Date(2026, 10, 16), 'NW')?.date).toBe(
			'2026-12-25'
		);
		expect(nextHoliday(new Date(2026, 10, 16), 'SN')?.date).toBe(
			'2026-11-18'
		);
		// Past the last one of the year: the first of the next.
		expect(nextHoliday(new Date(2026, 11, 27), 'NW')?.date).toBe(
			'2027-01-01'
		);
		// The day itself counts.
		expect(nextHoliday(new Date(2026, 11, 25, 15), 'NW')?.date).toBe(
			'2026-12-25'
		);
	});
});
