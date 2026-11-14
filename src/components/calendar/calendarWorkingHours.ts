/**
 * Working hours of the counsellor calendar (UserService#1649): weekly
 * windows of local wall-clock time. Outside them the calendar is shaded,
 * so evenings and weekends need no blockers of their own (Frank's
 * prototype, 2026-11-14). Display only — booking ignores them.
 *
 * Pure functions, so the dialog, FullCalendar and the free-time search
 * read one rule set.
 */
import type {
	CalendarWorkingHoursDTO,
	CalendarWorkingHoursWindowDTO
} from '../../api/apiCalendar';

/** Weekday in JavaScript numbering: 0 = Sunday .. 6 = Saturday. */
export interface WorkingHoursWindow {
	weekday: number;
	/** HH:mm */
	start: string;
	/** HH:mm */
	end: string;
}

/** Every window of the week; empty = no working hours set. */
export type WorkingHours = WorkingHoursWindow[];

/** UserService accepts at most this many windows. */
export const MAX_WORKING_HOURS_WINDOWS = 14;

/** Monday first, the order the dialog lists the days in. */
export const WEEKDAYS_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Where the free-time search looks on a day when no hours are set. */
export const FALLBACK_DAY = { start: '08:00', end: '18:00' };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (value: string) => TIME.test(value);

/** Minutes since midnight of an HH:mm string. */
export const minutesOf = (time: string) => {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
};

const byWeekdayAndStart = (a: WorkingHoursWindow, b: WorkingHoursWindow) =>
	a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start);

const validWindow = (w: CalendarWorkingHoursWindowDTO) =>
	Number.isInteger(w.weekday) &&
	w.weekday >= 0 &&
	w.weekday <= 6 &&
	isTime(w.start) &&
	isTime(w.end) &&
	minutesOf(w.end) > minutesOf(w.start);

/** UserService's answer, sorted; anything malformed is left out. */
export const workingHoursFromApi = (
	dto?: Partial<CalendarWorkingHoursDTO> | null
): WorkingHours =>
	(dto?.windows ?? [])
		.filter(validWindow)
		.map(({ weekday, start, end }) => ({ weekday, start, end }))
		.sort(byWeekdayAndStart);

export const workingHoursToApi = (
	hours: WorkingHours
): CalendarWorkingHoursDTO => ({
	windows: [...hours]
		.filter(validWindow)
		.sort(byWeekdayAndStart)
		.slice(0, MAX_WORKING_HOURS_WINDOWS)
		.map(({ weekday, start, end }) => ({ weekday, start, end }))
});

/**
 * FullCalendar `businessHours`: one block per window, `false` when none is
 * set (then nothing is shaded).
 */
export const businessHoursOf = (hours: WorkingHours) =>
	hours.length === 0
		? false
		: hours.map((w) => ({
				daysOfWeek: [w.weekday],
				startTime: w.start,
				endTime: w.end
			}));

const hm = (date: Date) => date.getHours() * 60 + date.getMinutes();

const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

/**
 * Whether a range lies inside one window of its day. Without working hours
 * everything counts as inside, so nothing warns.
 */
export const isWithinWorkingHours = (
	start: Date,
	end: Date,
	hours: WorkingHours
) => {
	if (hours.length === 0) return true;
	const last = new Date(end.getTime() - 1);
	if (!sameDay(start, last)) return false;
	const from = hm(start);
	const to = hm(last) + 1;
	return hours.some(
		(w) =>
			w.weekday === start.getDay() &&
			minutesOf(w.start) <= from &&
			minutesOf(w.end) >= to
	);
};

/** The windows of one weekday, earliest first. */
export const windowsOn = (hours: WorkingHours, weekday: number) =>
	hours.filter((w) => w.weekday === weekday).sort(byWeekdayAndStart);

/** One row of the working-hours dialog. */
export interface WorkingDayRow {
	weekday: number;
	enabled: boolean;
	start: string;
	end: string;
}

/**
 * The dialog edits one window per weekday. Should UserService ever hold two
 * on one day, the row spans from the first start to the last end.
 */
export const workingHoursToRows = (hours: WorkingHours): WorkingDayRow[] => {
	const template = hours[0] ?? {
		start: FALLBACK_DAY.start,
		end: FALLBACK_DAY.end
	};
	return WEEKDAYS_MONDAY_FIRST.map((weekday) => {
		const day = windowsOn(hours, weekday);
		if (day.length === 0)
			return {
				weekday,
				enabled: false,
				start: template.start,
				end: template.end
			};
		return {
			weekday,
			enabled: true,
			start: day[0].start,
			end: day.reduce(
				(latest, w) =>
					minutesOf(w.end) > minutesOf(latest) ? w.end : latest,
				day[0].end
			)
		};
	});
};

/**
 * A break inside every working day, e.g. lunch (Frank, 2026-11-14): on by
 * default, 12:00–13:00. UserService has no break of its own; a day with a
 * break is stored as two windows.
 */
export interface DayBreak {
	enabled: boolean;
	start: string;
	end: string;
}

export const DEFAULT_BREAK: DayBreak = {
	enabled: true,
	start: '12:00',
	end: '13:00'
};

/**
 * The break the stored windows show: every working day split by the same
 * gap. With no hours set yet, the default break.
 */
export const breakOf = (hours: WorkingHours): DayBreak => {
	if (hours.length === 0) return DEFAULT_BREAK;
	const off = { ...DEFAULT_BREAK, enabled: false };
	let gap: { start: string; end: string } | undefined;
	for (const weekday of WEEKDAYS_MONDAY_FIRST) {
		const day = windowsOn(hours, weekday);
		if (day.length === 0) continue;
		if (day.length !== 2) return off;
		const next = { start: day[0].end, end: day[1].start };
		if (gap && (gap.start !== next.start || gap.end !== next.end))
			return off;
		gap = next;
	}
	return gap ? { enabled: true, ...gap } : off;
};

export const isBreakValid = (b: DayBreak) =>
	!b.enabled ||
	(isTime(b.start) && isTime(b.end) && minutesOf(b.end) > minutesOf(b.start));

/**
 * The rows that are switched on and complete, as windows; a day that spans
 * the break becomes two.
 */
export const rowsToWorkingHours = (
	rows: WorkingDayRow[],
	dayBreak?: DayBreak
): WorkingHours =>
	rows
		.filter(
			(r) =>
				r.enabled &&
				isTime(r.start) &&
				isTime(r.end) &&
				minutesOf(r.end) > minutesOf(r.start)
		)
		.flatMap(({ weekday, start, end }) =>
			dayBreak?.enabled &&
			isBreakValid(dayBreak) &&
			minutesOf(start) < minutesOf(dayBreak.start) &&
			minutesOf(end) > minutesOf(dayBreak.end)
				? [
						{ weekday, start, end: dayBreak.start },
						{ weekday, start: dayBreak.end, end }
					]
				: [{ weekday, start, end }]
		)
		.sort(byWeekdayAndStart);

/** Weekdays whose row is on but ends before it starts. */
export const invalidRows = (rows: WorkingDayRow[]) =>
	rows
		.filter(
			(r) =>
				r.enabled &&
				(!isTime(r.start) ||
					!isTime(r.end) ||
					minutesOf(r.end) <= minutesOf(r.start))
		)
		.map((r) => r.weekday);

/** Days with the same hours, for the one-line summary "Mo–Fr 08:00–18:00". */
export interface WorkingHoursGroup {
	/** Monday-first order. */
	weekdays: number[];
	start: string;
	end: string;
	/** The days follow each other without a gap, e.g. Monday to Friday. */
	contiguous: boolean;
}

const mondayIndex = (weekday: number) => (weekday + 6) % 7;

export const groupWorkingHours = (hours: WorkingHours): WorkingHoursGroup[] => {
	const groups: WorkingHoursGroup[] = [];
	for (const row of workingHoursToRows(hours).filter((r) => r.enabled)) {
		const group = groups.find(
			(g) => g.start === row.start && g.end === row.end
		);
		if (group) group.weekdays.push(row.weekday);
		else
			groups.push({
				weekdays: [row.weekday],
				start: row.start,
				end: row.end,
				contiguous: true
			});
	}
	return groups.map((g) => ({
		...g,
		contiguous: g.weekdays.every(
			(d, i) =>
				i === 0 || mondayIndex(d) === mondayIndex(g.weekdays[i - 1]) + 1
		)
	}));
};
