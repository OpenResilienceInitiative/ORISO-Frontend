/**
 * Working hours of the counsellor calendar (UserService#1649, contract
 * v1.2): weekly windows of local wall-clock time, single dates moved by
 * hand and the public holidays of a Bundesland. Outside them the calendar
 * is shaded, so evenings and weekends need no blockers of their own (Frank's
 * prototype, 2026-11-14). Display only — booking ignores them.
 *
 * Pure functions, so the dialog, FullCalendar and the free-time search
 * read one rule set.
 */
import type {
	CalendarWorkingDayExceptionDTO,
	CalendarWorkingHoursDTO,
	CalendarWorkingHoursWindowDTO,
	CalendarWorkingTimeWindowDTO
} from '../../api/apiCalendar';
import {
	dateKeyOf,
	holidayOn,
	isHolidayRegion,
	type HolidayRegion,
	type PublicHoliday
} from './calendarHolidays';

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

const hm = (date: Date) => date.getHours() * 60 + date.getMinutes();

const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

/** The windows of one weekday, earliest first. */
export const windowsOn = (hours: WorkingHours, weekday: number) =>
	hours.filter((w) => w.weekday === weekday).sort(byWeekdayAndStart);

/* ------------------------------------------------------------------ */
/* One date: day exceptions and public holidays (contract v1.2)         */
/* ------------------------------------------------------------------ */

/** A window of one date: a weekly window without weekday. */
export interface TimeWindow {
	/** HH:mm */
	start: string;
	/** HH:mm */
	end: string;
}

/** Day exceptions by local date (YYYY-MM-DD); an empty list = day off. */
export type DayExceptions = Record<string, TimeWindow[]>;

/**
 * Everything that decides the working time of a date: the weekly windows,
 * the days moved by hand ("Nur an diesem Tag") and the Bundesland whose
 * public holidays are days off.
 */
export interface WorkingPlan {
	hours: WorkingHours;
	exceptions?: DayExceptions;
	holidayRegion?: HolidayRegion | null;
}

/** UserService accepts at most this many windows on one date. */
export const MAX_EXCEPTION_WINDOWS = 4;

/** The plain weekly list still works wherever a plan is read. */
export const planOf = (input: WorkingHours | WorkingPlan): WorkingPlan =>
	Array.isArray(input) ? { hours: input } : input;

/** Sorted by start, valid, without overlaps, at most four. */
export const normalizeWindows = (windows: TimeWindow[]): TimeWindow[] => {
	const sorted = windows
		.filter(
			(w) =>
				isTime(w.start) &&
				isTime(w.end) &&
				minutesOf(w.end) > minutesOf(w.start)
		)
		.map(({ start, end }) => ({ start, end }))
		.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
	const out: TimeWindow[] = [];
	for (const w of sorted) {
		const last = out[out.length - 1];
		if (last && minutesOf(w.start) < minutesOf(last.end)) continue;
		out.push(w);
	}
	return out.slice(0, MAX_EXCEPTION_WINDOWS);
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const dayExceptionsFromApi = (
	list?: CalendarWorkingDayExceptionDTO[] | null
): DayExceptions =>
	Object.fromEntries(
		(list ?? [])
			.filter((e) => typeof e?.date === 'string' && DATE.test(e.date))
			.map((e) => [e.date, normalizeWindows(e.windows ?? [])])
	);

/** UserService's answer as one plan; an unknown region counts as none. */
export const workingPlanFromApi = (
	dto?: Partial<CalendarWorkingHoursDTO> | null
): WorkingPlan => ({
	hours: workingHoursFromApi(dto),
	exceptions: dayExceptionsFromApi(dto?.exceptions),
	holidayRegion: isHolidayRegion(dto?.holidayRegion)
		? dto!.holidayRegion
		: null
});

/** PUT always sends windows and the region (absent = holidays off). */
export const workingPlanToApi = (
	plan: WorkingPlan
): Omit<CalendarWorkingHoursDTO, 'exceptions'> => ({
	...workingHoursToApi(plan.hours),
	holidayRegion: plan.holidayRegion ?? null
});

export const exceptionWindowsToApi = (
	windows: TimeWindow[]
): CalendarWorkingTimeWindowDTO[] =>
	normalizeWindows(windows).map(({ start, end }) => ({ start, end }));

/** Where a date's working time comes from. */
export type EffectiveSource = 'exception' | 'holiday' | 'weekly' | 'none';

export interface EffectiveDay {
	/** Empty = the whole day off (or, for `none`, nothing set at all). */
	windows: TimeWindow[];
	source: EffectiveSource;
	/** The public holiday of that date, when a region is set. */
	holiday?: PublicHoliday;
}

/**
 * The working time of one date: its exception if there is one, else a
 * public holiday of the region (the day off), else the weekly windows.
 * `none` means no working hours are set at all: nothing is shaded.
 */
export const effectiveDay = (
	date: Date,
	input: WorkingHours | WorkingPlan
): EffectiveDay => {
	const plan = planOf(input);
	const holiday = holidayOn(date, plan.holidayRegion);
	const exception = plan.exceptions?.[dateKeyOf(date)];
	if (exception) return { windows: exception, source: 'exception', holiday };
	if (holiday) return { windows: [], source: 'holiday', holiday };
	if (plan.hours.length === 0) return { windows: [], source: 'none' };
	return {
		windows: windowsOn(plan.hours, date.getDay()).map(({ start, end }) => ({
			start,
			end
		})),
		source: 'weekly'
	};
};

/** Shaded time of one day, as minutes since midnight. */
export interface OffRange {
	from: number;
	to: number;
	/** `break` between two windows (e.g. lunch), else before/after/all day. */
	kind: 'off' | 'break';
	/**
	 * This range borders where work starts (`start`, the morning) or ends
	 * (`end`, the evening): the grips sit there.
	 */
	edge?: 'start' | 'end';
}

const DAY_MINUTES = 24 * 60;

/** The day minus its working windows; nothing when no hours are set. */
export const offRangesOf = (day: Date, input: WorkingHours | WorkingPlan) => {
	const { windows, source } = effectiveDay(day, input);
	if (source === 'none') return [];
	if (windows.length === 0)
		return [{ from: 0, to: DAY_MINUTES, kind: 'off' as const }];
	const out: OffRange[] = [];
	const first = minutesOf(windows[0].start);
	if (first > 0) out.push({ from: 0, to: first, kind: 'off', edge: 'start' });
	for (let i = 1; i < windows.length; i++) {
		const from = minutesOf(windows[i - 1].end);
		const to = minutesOf(windows[i].start);
		if (to > from) out.push({ from, to, kind: 'break' });
	}
	const last = minutesOf(windows[windows.length - 1].end);
	if (last < DAY_MINUTES)
		out.push({ from: last, to: DAY_MINUTES, kind: 'off', edge: 'end' });
	return out;
};

/** Where the grips of a working day sit; none on a day off. */
export const dayEdgesOf = (day: Date, input: WorkingHours | WorkingPlan) => {
	const { windows, source } = effectiveDay(day, input);
	if (windows.length === 0) return null;
	return {
		start: windows[0].start,
		end: windows[windows.length - 1].end,
		exception: source === 'exception',
		windows
	};
};

/** Grips move in quarter hours; a working day keeps at least an hour. */
export const EDGE_STEP_MINUTES = 15;
export const MIN_WORKING_MINUTES = 60;
const LAST_EDGE = DAY_MINUTES - EDGE_STEP_MINUTES;

export const timeOfMinutes = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Where an edge may go: snapped to the quarter hour, inside the day and at
 * least an hour away from the other edge.
 */
export const clampEdge = (
	windows: TimeWindow[],
	edge: 'start' | 'end',
	minutes: number
) => {
	const snapped =
		Math.round(minutes / EDGE_STEP_MINUTES) * EDGE_STEP_MINUTES;
	if (edge === 'start') {
		const latest =
			minutesOf(windows[windows.length - 1].end) - MIN_WORKING_MINUTES;
		return Math.max(0, Math.min(snapped, latest, LAST_EDGE));
	}
	const earliest = minutesOf(windows[0].start) + MIN_WORKING_MINUTES;
	return Math.min(LAST_EDGE, Math.max(snapped, earliest, 0));
};

/**
 * The windows with work starting (or ending) at `time`. A break inside the
 * day stays; windows the new edge passes drop out.
 */
export const moveEdge = (
	windows: TimeWindow[],
	edge: 'start' | 'end',
	time: string
): TimeWindow[] => {
	if (windows.length === 0) return [];
	const at = clampEdge(windows, edge, minutesOf(time));
	const t = timeOfMinutes(at);
	if (edge === 'start') {
		const kept = windows.filter((w) => minutesOf(w.end) > at);
		return kept.map((w, i) => (i === 0 ? { ...w, start: t } : w));
	}
	const kept = windows.filter((w) => minutesOf(w.start) < at);
	return kept.map((w, i) => (i === kept.length - 1 ? { ...w, end: t } : w));
};

/** The weekly hours with one weekday's windows replaced. */
export const withWeekdayWindows = (
	hours: WorkingHours,
	weekday: number,
	windows: TimeWindow[]
): WorkingHours =>
	[
		...hours.filter((w) => w.weekday !== weekday),
		...windows.map(({ start, end }) => ({ weekday, start, end }))
	].sort(byWeekdayAndStart);

export const sameWindows = (a: TimeWindow[], b: TimeWindow[]) =>
	a.length === b.length &&
	a.every((w, i) => w.start === b[i].start && w.end === b[i].end);

/**
 * Whether a range lies inside one window of its day (exceptions and
 * holidays count). Without working hours everything counts as inside, so
 * nothing warns.
 */
export const isWithinWorkingHours = (
	start: Date,
	end: Date,
	hours: WorkingHours | WorkingPlan
) => {
	const day = effectiveDay(start, hours);
	if (day.source === 'none') return true;
	const last = new Date(end.getTime() - 1);
	if (!sameDay(start, last)) return false;
	const from = hm(start);
	const to = hm(last) + 1;
	return day.windows.some(
		(w) => minutesOf(w.start) <= from && minutesOf(w.end) >= to
	);
};

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
 * The break the stored windows show: every day that spans it is split by
 * the same gap. A day that ends before the break or starts after it (Friday
 * 08:00–12:00) does not count against it. With no hours set yet, the
 * default break.
 */
export const breakOf = (hours: WorkingHours): DayBreak => {
	if (hours.length === 0) return DEFAULT_BREAK;
	const off = { ...DEFAULT_BREAK, enabled: false };
	const days = WEEKDAYS_MONDAY_FIRST.map((weekday) =>
		windowsOn(hours, weekday)
	).filter((day) => day.length > 0);
	let gap: { start: string; end: string } | undefined;
	for (const day of days) {
		if (day.length > 2) return off;
		if (day.length !== 2) continue;
		const next = { start: day[0].end, end: day[1].start };
		if (gap && (gap.start !== next.start || gap.end !== next.end))
			return off;
		gap = next;
	}
	if (!gap) return off;
	const { start, end } = gap;
	// A single window across the gap would be split on the next save.
	const spansGap = days.some(
		(day) =>
			day.length === 1 &&
			minutesOf(day[0].start) < minutesOf(start) &&
			minutesOf(day[0].end) > minutesOf(end)
	);
	return spansGap ? off : { enabled: true, start, end };
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
