import dayjs, { Dayjs } from 'dayjs';
import {
	ConsultantStatisticsBreakdown,
	ConsultantStatisticsDTO
} from '../../api/apiGetConsultantStatistics';

export const statisticsPeriods = [
	'currentWeek',
	'lastWeek',
	'currentMonth',
	'lastMonth',
	'currentYear',
	'lastYear'
] as const;

export type StatisticsPeriod = (typeof statisticsPeriods)[number];

const DATE = 'YYYY-MM-DD';

/** Monday of the week `day` lies in; dayjs counts Sunday as day 0. */
const mondayOf = (day: Dayjs) => day.subtract((day.day() + 6) % 7, 'day');

/** First and last calendar day of the period; weeks run Monday to Sunday. */
export const datesForPeriod = (
	period: StatisticsPeriod,
	today: Dayjs = dayjs()
): { startDate: string; endDate: string } => {
	const range = (start: Dayjs, end: Dayjs) => ({
		startDate: start.format(DATE),
		endDate: end.format(DATE)
	});
	switch (period) {
		case 'currentWeek':
			return range(mondayOf(today), mondayOf(today).add(6, 'day'));
		case 'lastWeek': {
			const monday = mondayOf(today).subtract(7, 'day');
			return range(monday, monday.add(6, 'day'));
		}
		case 'currentMonth':
			return range(today.startOf('month'), today.endOf('month'));
		case 'lastMonth': {
			const month = today.subtract(1, 'month');
			return range(month.startOf('month'), month.endOf('month'));
		}
		case 'currentYear':
			return range(today.startOf('year'), today.endOf('year'));
		case 'lastYear': {
			const year = today.subtract(1, 'year');
			return range(year.startOf('year'), year.endOf('year'));
		}
	}
};

/** The CSV splits a week into days, a month into weeks, a year into months. */
export const breakdownForPeriod = (
	period: StatisticsPeriod
): ConsultantStatisticsBreakdown =>
	period.endsWith('Week')
		? 'DAY'
		: period.endsWith('Month')
			? 'WEEK'
			: 'MONTH';

/** Columns of the CSV, in order; the label key sits under `profile.statistics.csvHeader`. */
export const csvColumns = [
	'period',
	'numberOfAppointments',
	'numberOfVideoAppointments',
	'numberOfPhoneAppointments',
	'numberOfOnsiteAppointments',
	'numberOfChatAppointments',
	'numberOfCancelledAppointments',
	'numberOfAssignedSessions',
	'numberOfActiveSessions',
	'numberOfSentMessages'
] as const;

export type CsvRow = Record<(typeof csvColumns)[number], string | number>;

const periodLabel = (startDate: string, endDate: string) => {
	const start = dayjs(startDate).format('DD.MM.YYYY');
	const end = dayjs(endDate).format('DD.MM.YYYY');
	return start === end ? start : `${start} - ${end}`;
};

const row = (figures: ConsultantStatisticsDTO, period: string): CsvRow => ({
	period,
	numberOfAppointments: figures.numberOfAppointments ?? 0,
	numberOfVideoAppointments: figures.numberOfVideoAppointments ?? 0,
	numberOfPhoneAppointments: figures.numberOfPhoneAppointments ?? 0,
	numberOfOnsiteAppointments: figures.numberOfOnsiteAppointments ?? 0,
	numberOfChatAppointments: figures.numberOfChatAppointments ?? 0,
	numberOfCancelledAppointments: figures.numberOfCancelledAppointments ?? 0,
	numberOfAssignedSessions: figures.numberOfAssignedSessions,
	numberOfActiveSessions: figures.numberOfActiveSessions,
	numberOfSentMessages: figures.numberOfSentMessages
});

/** One row per part of the period, then the total row labelled `totalLabel`. */
export const csvRows = (
	statistics: ConsultantStatisticsDTO,
	totalLabel: string
): CsvRow[] => [
	...(statistics.breakdown ?? []).map((part) =>
		row(part, periodLabel(part.startDate, part.endDate))
	),
	row(
		statistics,
		`${totalLabel} ${periodLabel(statistics.startDate, statistics.endDate)}`
	)
];
