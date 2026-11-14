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

/** More windows than UserService accepts: the change must be refused. */
export const exceedsWindowLimit = (hours: WorkingHours) =>
	hours.filter(validWindow).length > MAX_WORKING_HOURS_WINDOWS;

/**
 * The request body. Never cut to the limit — that would drop another
 * weekday's hours unseen; callers refuse such a change with a message
 * ({@link exceedsWindowLimit}), and this throws as the last guard.
 */
export const workingHoursToApi = (
	hours: WorkingHours
): CalendarWorkingHoursDTO => {
	if (exceedsWindowLimit(hours))
		throw new RangeError(
			`At most ${MAX_WORKING_HOURS_WINDOWS} working-hours windows`
		);
	return {
		windows: [...hours]
			.filter(validWindow)
			.sort(byWeekdayAndStart)
			.map(({ weekday, start, end }) => ({ weekday, start, end }))
	};
};

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

/**
 * The grips of a working day: where work starts and ends and, on a day
 * with two windows, where the pause starts and ends.
 */
export type WorkEdge = 'start' | 'end' | 'pauseStart' | 'pauseEnd';

/** "Arbeitsbeginn", "Arbeitsende", "Pausenbeginn", "Pausenende". */
export const edgeLabelKey = (edge: WorkEdge) => `calendar.grip.${edge}`;

export const isPauseEdge = (edge: WorkEdge) =>
	edge === 'pauseStart' || edge === 'pauseEnd';

/** The day's pause: the gap between its two windows. */
export const pauseOf = (windows: TimeWindow[]) =>
	windows.length === 2 &&
	minutesOf(windows[1].start) > minutesOf(windows[0].end)
		? { start: windows[0].end, end: windows[1].start }
		: null;

/** Where the grips of a working day sit; none on a day off. */
export const dayEdgesOf = (day: Date, input: WorkingHours | WorkingPlan) => {
	const { windows, source } = effectiveDay(day, input);
	if (windows.length === 0) return null;
	return {
		start: windows[0].start,
		end: windows[windows.length - 1].end,
		pause: pauseOf(windows),
		exception: source === 'exception',
		windows
	};
};

/** Every grip of the day with its time: start, the pause, end. */
export const gripEdges = (edges: {
	start: string;
	end: string;
	pause: { start: string; end: string } | null;
}): { edge: WorkEdge; time: string }[] => [
	{ edge: 'start', time: edges.start },
	...(edges.pause
		? [
				{ edge: 'pauseStart' as const, time: edges.pause.start },
				{ edge: 'pauseEnd' as const, time: edges.pause.end }
			]
		: []),
	{ edge: 'end', time: edges.end }
];

/** The time a grip of the day stands at, if the day has that grip. */
export const edgeTime = (windows: TimeWindow[], edge: WorkEdge) => {
	if (windows.length === 0) return null;
	if (edge === 'start') return windows[0].start;
	if (edge === 'end') return windows[windows.length - 1].end;
	const pause = pauseOf(windows);
	if (!pause) return null;
	return edge === 'pauseStart' ? pause.start : pause.end;
};

/**
 * Grips move in quarter hours; a working day keeps at least an hour, a
 * pause at least a quarter hour, inside the working time.
 */
export const EDGE_STEP_MINUTES = 15;
export const MIN_WORKING_MINUTES = 60;
export const MIN_PAUSE_MINUTES = 15;
const LAST_EDGE = DAY_MINUTES - EDGE_STEP_MINUTES;

export const timeOfMinutes = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Where an edge may go: snapped to the quarter hour, inside the day and at
 * least an hour away from the other edge.
 */
export const clampEdge = (
	windows: TimeWindow[],
	edge: WorkEdge,
	minutes: number
) => {
	const snapped = Math.round(minutes / EDGE_STEP_MINUTES) * EDGE_STEP_MINUTES;
	if (isPauseEdge(edge)) {
		const pause = pauseOf(windows);
		if (!pause) return snapped;
		const dayStart = minutesOf(windows[0].start);
		const dayEnd = minutesOf(windows[1].end);
		const [low, high] =
			edge === 'pauseStart'
				? [
						dayStart + EDGE_STEP_MINUTES,
						minutesOf(pause.end) - MIN_PAUSE_MINUTES
					]
				: [
						minutesOf(pause.start) + MIN_PAUSE_MINUTES,
						dayEnd - EDGE_STEP_MINUTES
					];
		return Math.max(low, Math.min(high, snapped));
	}
	if (edge === 'start') {
		const latest =
			minutesOf(windows[windows.length - 1].end) - MIN_WORKING_MINUTES;
		return Math.max(0, Math.min(snapped, latest, LAST_EDGE));
	}
	const earliest = minutesOf(windows[0].start) + MIN_WORKING_MINUTES;
	return Math.min(LAST_EDGE, Math.max(snapped, earliest, 0));
};

/**
 * Where a pause grip may be dragged: anywhere inside the working time. Onto
 * or past the other pause grip, it asks to delete or move the pause
 * (Frank, prototype v16), instead of stopping a quarter hour short.
 */
export const clampPauseDrag = (windows: TimeWindow[], minutes: number) => {
	const snapped = Math.round(minutes / EDGE_STEP_MINUTES) * EDGE_STEP_MINUTES;
	if (windows.length === 0) return snapped;
	const low = minutesOf(windows[0].start) + EDGE_STEP_MINUTES;
	const high = minutesOf(windows[windows.length - 1].end) - EDGE_STEP_MINUTES;
	return Math.max(low, Math.min(high, snapped));
};

/** One pause grip pulled onto or past the other. */
export const pauseCrossed = (
	windows: TimeWindow[],
	edge: WorkEdge,
	time: string
) => {
	const pause = pauseOf(windows);
	if (!pause || !isPauseEdge(edge)) return false;
	const at = minutesOf(time);
	return edge === 'pauseStart'
		? at > minutesOf(pause.end) - MIN_PAUSE_MINUTES
		: at < minutesOf(pause.start) + MIN_PAUSE_MINUTES;
};

/**
 * The pause moved whole to where its grip was dropped: same length, inside
 * the working time. None when it does not fit or would not move.
 */
export const pauseMovedTo = (
	windows: TimeWindow[],
	edge: WorkEdge,
	time: string
): TimeWindow | null => {
	const pause = pauseOf(windows);
	if (!pause) return null;
	const length = minutesOf(pause.end) - minutesOf(pause.start);
	const low = minutesOf(windows[0].start) + EDGE_STEP_MINUTES;
	const high = minutesOf(windows[1].end) - EDGE_STEP_MINUTES - length;
	if (high < low) return null;
	const wanted =
		edge === 'pauseStart' ? minutesOf(time) : minutesOf(time) - length;
	const from = Math.max(low, Math.min(high, wanted));
	if (from === minutesOf(pause.start)) return null;
	return { start: timeOfMinutes(from), end: timeOfMinutes(from + length) };
};

/** The day with its pause taken out: one window. */
export const withoutPause = (windows: TimeWindow[]): TimeWindow[] =>
	pauseOf(windows)
		? [{ start: windows[0].start, end: windows[1].end }]
		: windows;

/** The day with its pause at `pause`. */
export const withPauseAt = (
	windows: TimeWindow[],
	pause: TimeWindow
): TimeWindow[] =>
	windows.length === 0
		? windows
		: [
				{ start: windows[0].start, end: pause.start },
				{ start: pause.end, end: windows[windows.length - 1].end }
			];

/**
 * The windows with work starting (or ending) at `time`. A break inside the
 * day stays; windows the new edge passes drop out.
 */
export const moveEdge = (
	windows: TimeWindow[],
	edge: WorkEdge,
	time: string
): TimeWindow[] => {
	if (windows.length === 0) return [];
	const at = clampEdge(windows, edge, minutesOf(time));
	const t = timeOfMinutes(at);
	if (isPauseEdge(edge)) {
		if (!pauseOf(windows)) return windows;
		return edge === 'pauseStart'
			? [{ ...windows[0], end: t }, windows[1]]
			: [windows[0], { ...windows[1], start: t }];
	}
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

/**
 * A pause inside one working day (Frank, prototype v15: "Pause", per
 * weekday). UserService has no pause of its own: it is the gap between the
 * day's two windows.
 */
export interface DayPause {
	enabled: boolean;
	start: string;
	end: string;
}

/** On by default, 12:00–13:00, for a day that has none yet. */
export const DEFAULT_PAUSE: DayPause = {
	enabled: true,
	start: '12:00',
	end: '13:00'
};

/** One row of the working-hours dialog: one weekday with its pause. */
export interface WorkingDayRow {
	weekday: number;
	enabled: boolean;
	start: string;
	end: string;
	pause: DayPause;
}

/**
 * One row per weekday, Monday first. Two windows on a day are its hours
 * with the gap as its pause; more than two span from the first start to
 * the last end (the dialog keeps such a day as stored unless it is
 * edited). Before any hours are set, every day comes with the default
 * pause.
 */
export const workingHoursToRows = (hours: WorkingHours): WorkingDayRow[] => {
	const template = hours[0] ?? {
		start: FALLBACK_DAY.start,
		end: FALLBACK_DAY.end
	};
	const none = { ...DEFAULT_PAUSE, enabled: hours.length === 0 };
	return WEEKDAYS_MONDAY_FIRST.map((weekday) => {
		const day = windowsOn(hours, weekday);
		if (day.length === 0)
			return {
				weekday,
				enabled: false,
				start: template.start,
				end: template.end,
				pause: none
			};
		return {
			weekday,
			enabled: true,
			start: day[0].start,
			end: day.reduce(
				(latest, w) =>
					minutesOf(w.end) > minutesOf(latest) ? w.end : latest,
				day[0].end
			),
			pause:
				day.length >= 2
					? { enabled: true, start: day[0].end, end: day[1].start }
					: { ...DEFAULT_PAUSE, enabled: false }
		};
	});
};

/** A pause that is off, or ends after it starts inside the working time. */
export const isPauseValid = ({ start, end, pause }: WorkingDayRow) =>
	!pause.enabled ||
	(isTime(pause.start) &&
		isTime(pause.end) &&
		minutesOf(pause.start) > minutesOf(start) &&
		minutesOf(pause.end) > minutesOf(pause.start) &&
		minutesOf(pause.end) < minutesOf(end));

/** One row as windows: its hours, split by its pause. */
const rowWindows = (row: WorkingDayRow): WorkingHoursWindow[] => {
	const { weekday, start, end, pause } = row;
	if (!pause.enabled || !isPauseValid(row)) return [{ weekday, start, end }];
	return [
		{ weekday, start, end: pause.start },
		{ weekday, start: pause.end, end }
	];
};

/** The rows that are switched on and complete, as windows. */
export const rowsToWorkingHours = (rows: WorkingDayRow[]): WorkingHours =>
	rows
		.filter(
			(r) =>
				r.enabled &&
				isTime(r.start) &&
				isTime(r.end) &&
				minutesOf(r.end) > minutesOf(r.start)
		)
		.flatMap(rowWindows)
		.sort(byWeekdayAndStart);

const samePause = (a: DayPause, b: DayPause) =>
	a.enabled === b.enabled &&
	(!a.enabled || (a.start === b.start && a.end === b.end));

const sameRow = (a: WorkingDayRow, b?: WorkingDayRow) =>
	!!b &&
	a.enabled === b.enabled &&
	a.start === b.start &&
	a.end === b.end &&
	samePause(a.pause, b.pause);

/**
 * What the dialog saves: every day the user left alone keeps its stored
 * windows (a third window the row cannot show stays as it was); an edited
 * day is its hours split by its own pause.
 */
export const dialogWorkingHours = (
	stored: WorkingHours,
	rows: WorkingDayRow[]
): WorkingHours => {
	const initialRows = workingHoursToRows(stored);
	return rows
		.flatMap((row) =>
			sameRow(
				row,
				initialRows.find((r) => r.weekday === row.weekday)
			)
				? windowsOn(stored, row.weekday)
				: rowsToWorkingHours([row])
		)
		.sort(byWeekdayAndStart);
};

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

/** Weekdays that are on with a pause outside their hours or reversed. */
export const invalidPauses = (rows: WorkingDayRow[]) =>
	rows.filter((r) => r.enabled && !isPauseValid(r)).map((r) => r.weekday);

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
