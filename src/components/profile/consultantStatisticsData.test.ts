import { describe, expect, it } from 'vite-plus/test';
import dayjs from 'dayjs';
import {
	breakdownForPeriod,
	csvRows,
	csvColumns,
	datesForPeriod,
	figureLabelKey
} from './consultantStatisticsData';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';

// Wednesday 15 July 2026
const today = dayjs('2026-07-15T12:00:00');

describe('datesForPeriod', () => {
	it('runs a week from Monday to Sunday', () => {
		expect(datesForPeriod('currentWeek', today)).toEqual({
			startDate: '2026-07-13',
			endDate: '2026-07-19'
		});
		expect(datesForPeriod('lastWeek', today)).toEqual({
			startDate: '2026-07-06',
			endDate: '2026-07-12'
		});
	});

	it('treats Sunday as the last day of its week, not the first', () => {
		expect(
			datesForPeriod('currentWeek', dayjs('2026-07-19T20:00:00'))
		).toEqual({ startDate: '2026-07-13', endDate: '2026-07-19' });
	});

	it('keeps the month and year periods', () => {
		expect(datesForPeriod('currentMonth', today)).toEqual({
			startDate: '2026-07-01',
			endDate: '2026-07-31'
		});
		expect(datesForPeriod('lastMonth', today)).toEqual({
			startDate: '2026-06-01',
			endDate: '2026-06-30'
		});
		expect(datesForPeriod('currentYear', today)).toEqual({
			startDate: '2026-01-01',
			endDate: '2026-12-31'
		});
		expect(datesForPeriod('lastYear', today)).toEqual({
			startDate: '2025-01-01',
			endDate: '2025-12-31'
		});
	});
});

describe('breakdownForPeriod', () => {
	it('splits a week into days, a month into weeks and a year into months', () => {
		expect(breakdownForPeriod('currentWeek')).toBe('DAY');
		expect(breakdownForPeriod('lastMonth')).toBe('WEEK');
		expect(breakdownForPeriod('lastYear')).toBe('MONTH');
	});
});

describe('csvRows', () => {
	const figures = (startDate: string, endDate: string, n: number) => ({
		startDate,
		endDate,
		numberOfAssignedSessions: n,
		numberOfActiveSessions: n + 1,
		numberOfSentMessages: n + 2,
		numberOfAppointments: n + 3,
		numberOfVideoAppointments: 1,
		numberOfPhoneAppointments: 1,
		numberOfOnsiteAppointments: 0,
		numberOfChatAppointments: n + 1,
		numberOfCancelledAppointments: 2
	});

	it('writes one row per part and a total row last', () => {
		const rows = csvRows(
			{
				...figures('2026-07-13', '2026-07-19', 10),
				breakdown: [
					figures('2026-07-13', '2026-07-13', 4),
					figures('2026-07-14', '2026-07-19', 6)
				]
			},
			'Gesamt'
		);

		expect(rows.map((row) => row.period)).toEqual([
			'13.07.2026',
			'14.07.2026 - 19.07.2026',
			'Gesamt 13.07.2026 - 19.07.2026'
		]);
		expect(rows[2]).toMatchObject({
			numberOfAppointments: 13,
			numberOfVideoAppointments: 1,
			numberOfCancelledAppointments: 2,
			numberOfAssignedSessions: 10,
			numberOfActiveSessions: 11,
			numberOfSentMessages: 12
		});
	});

	it('shows 0 for appointment figures an older backend does not send', () => {
		const rows = csvRows(
			{
				startDate: '2026-07-01',
				endDate: '2026-07-31',
				numberOfAssignedSessions: 1,
				numberOfActiveSessions: 2,
				numberOfSentMessages: 3
			},
			'Gesamt'
		);

		expect(rows).toHaveLength(1);
		expect(rows[0].numberOfAppointments).toBe(0);
		expect(rows[0].numberOfCancelledAppointments).toBe(0);
	});
});

describe('figureLabelKey', () => {
	it('has a German and English label for every CSV column', () => {
		for (const locale of [de, en]) {
			for (const column of csvColumns) {
				const path = figureLabelKey(column).split('.');
				const label = path.reduce(
					(node: unknown, part) =>
						(node as Record<string, unknown> | undefined)?.[part],
					locale as unknown
				);
				expect(typeof label, column).toBe('string');
			}
		}
	});
});
