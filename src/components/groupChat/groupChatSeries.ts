import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Every interval a group can be created with (`UserChatDTO.chatInterval`). */
export type GroupChatRepeat =
	| 'DAILY'
	| 'WEEKLY'
	| 'BIWEEKLY'
	| 'MONTHLY'
	| 'QUARTERLY'
	| 'YEARLY';

/**
 * A repeating group from one date on: how it repeats, how many dates are
 * left including that one, and the group's own timezone.
 */
export interface GroupChatSeries {
	repeat: GroupChatRepeat;
	count: number;
	timeZone?: string;
}

type Unit = 'day' | 'week' | 'month' | 'year';

/* The same steps as the UserService's `Chat.occurrenceStart`. */
const STEP: Record<GroupChatRepeat, { unit: Unit; size: number }> = {
	DAILY: { unit: 'day', size: 1 },
	WEEKLY: { unit: 'week', size: 1 },
	BIWEEKLY: { unit: 'week', size: 2 },
	MONTHLY: { unit: 'month', size: 1 },
	QUARTERLY: { unit: 'month', size: 3 },
	YEARLY: { unit: 'year', size: 1 }
};

const FREQ: Record<Unit, string> = {
	day: 'DAILY',
	week: 'WEEKLY',
	month: 'MONTHLY',
	year: 'YEARLY'
};

export const isGroupChatRepeat = (value: unknown): value is GroupChatRepeat =>
	typeof value === 'string' && value in STEP;

/**
 * `FREQ=WEEKLY;INTERVAL=2;COUNT=6` — always bounded by the dates left.
 * `startDay` is the first date's month and day on the group's clock: a
 * monthly series from the 29th–31st, or a yearly one from 29 February,
 * then falls back to the month's last day where that day is missing, as
 * the group does — a bare rule would skip those months (RFC 5545 3.3.10).
 */
export const groupChatRrule = (
	{ repeat, count }: GroupChatSeries,
	startDay?: { month: number; day: number }
) => {
	const { unit, size } = STEP[repeat];
	const lateDay =
		startDay &&
		startDay.day > 28 &&
		(unit === 'month' || (unit === 'year' && startDay.month === 2))
			? startDay.day
			: undefined;
	return [
		`FREQ=${FREQ[unit]}`,
		...(size > 1 ? [`INTERVAL=${size}`] : []),
		...(lateDay
			? [
					...(unit === 'year' ? ['BYMONTH=2'] : []),
					`BYMONTHDAY=${lateDay},-1`,
					'BYSETPOS=1'
				]
			: []),
		`COUNT=${Math.max(1, Math.floor(count))}`
	].join(';');
};

const WALL = 'YYYY-MM-DDTHH:mm:ss';

/**
 * The series' dates from `start` on, stepped on the group's wall clock: an
 * 18:00 group stays at 18:00 across the DST change, as the UserService
 * computes it. Calendar steps, not fixed milliseconds — a month is not 30
 * days. Without a known timezone the reader's own one is used.
 */
export const getGroupChatOccurrences = (
	start: Date,
	{ repeat, count, timeZone }: GroupChatSeries
): Date[] => {
	const { unit, size } = STEP[repeat];
	const steps = Array.from(
		{ length: Math.max(1, Math.floor(count)) },
		(_, index) => index * size
	);
	try {
		const zone = timeZone || dayjs.tz.guess();
		const wall = dayjs.utc(dayjs(start).tz(zone).format(WALL));
		return steps.map((step) =>
			dayjs.tz(wall.add(step, unit).format(WALL), zone).toDate()
		);
	} catch {
		// An unknown zone name: the reader's clock is the best guess left.
		return steps.map((step) => dayjs(start).add(step, unit).toDate());
	}
};
