/**
 * The views of "Meine Termine" (Frank's prototype, 2026-11-14): day, three
 * days, work week, week, month, list and "Nebeneinander" (one column per
 * person). The switch shows them as a menu or as a row of digits; the
 * choice is kept per person.
 */
export type CalendarViewName =
	| 'day'
	| 'threeDays'
	| 'workWeek'
	| 'week'
	| 'month'
	| 'list'
	| 'split';

export const DESKTOP_VIEWS: CalendarViewName[] = [
	'day',
	'threeDays',
	'workWeek',
	'week',
	'month',
	'list',
	'split'
];

/**
 * Up to this width the calendar uses the phone layout, tablets included
 * (Frank, prototype v15: its 960 px container). No shared breakpoint is
 * this wide ($fromLarge is 900), so the calendar keeps its own.
 */
export const COMPACT_MAX_WIDTH = 960;

/** Phones: no five- or seven-day grid, they do not fit. */
export const COMPACT_VIEWS: CalendarViewName[] = [
	'list',
	'day',
	'threeDays',
	'month',
	'split'
];

/** The digit on the switch; month, list and split show an icon instead. */
export const VIEW_DIGIT: Partial<Record<CalendarViewName, string>> = {
	day: '1',
	threeDays: '3',
	workWeek: '5',
	week: '7'
};

/** FullCalendar view per name; `split` is our own and has none. */
export const FC_VIEW: Record<Exclude<CalendarViewName, 'split'>, string> = {
	day: 'timeGridDay',
	threeDays: 'timeGridThreeDays',
	workWeek: 'timeGridWorkWeek',
	week: 'timeGridWeek',
	month: 'dayGridMonth',
	list: 'listTwoWeeks'
};

/**
 * Open question to Frank, answered with a default that is easy to change:
 * "Nebeneinander" shows this many days (one).
 */
export const SPLIT_VIEW_DAYS = 1;

/** Custom FullCalendar views. Module constant: FullCalendar resets on a new object. */
export const FC_CUSTOM_VIEWS = {
	timeGridThreeDays: {
		type: 'timeGrid',
		duration: { days: 3 },
		// Three days step one day at a time, like a sliding window.
		dateIncrement: { days: 1 }
	},
	// Open question to Frank, default: paging (arrows and swipe alike)
	// moves the work week by a whole week.
	timeGridWorkWeek: {
		type: 'timeGrid',
		duration: { weeks: 1 },
		hiddenDays: [0, 6]
	},
	// The list names each day once, "Montag, 16. November" (prototype v17).
	listTwoWeeks: {
		type: 'list',
		duration: { weeks: 2 },
		listDayFormat: {
			weekday: 'long' as const,
			day: 'numeric' as const,
			month: 'long' as const
		},
		listDayAltFormat: false as const
	},
	// The month heads name the weekday only.
	dayGridMonth: { dayHeaderFormat: { weekday: 'short' as const } }
};

export type ViewSwitcherStyle = 'menu' | 'digits';

/** The view name for a FullCalendar view type. */
export const viewOfFcType = (type: string): CalendarViewName | undefined =>
	(Object.keys(FC_VIEW) as (keyof typeof FC_VIEW)[]).find(
		(name) => FC_VIEW[name] === type
	);

const plusDays = (date: Date, days: number) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * The range title of the date bar (prototype v17): "Montag, 16. November
 * 2026" for one day, "November 2026" for the month, and otherwise the shown
 * days as a range, "16.–20. November 2026" for the work week (Monday to
 * Friday, not the whole week behind it). `start` is the first day,
 * `end` the day after the last; the locale words it.
 */
export const rangeTitleOf = (
	view: CalendarViewName,
	start: Date,
	end: Date,
	locale: string
) => {
	if (view === 'day' || plusDays(start, 1).getTime() >= end.getTime())
		return new Intl.DateTimeFormat(locale, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(start);
	if (view === 'month')
		return new Intl.DateTimeFormat(locale, {
			month: 'long',
			year: 'numeric'
		}).format(start);
	const last = view === 'workWeek' ? plusDays(start, 4) : plusDays(end, -1);
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).formatRange(start, last);
};

export const isTimeGrid = (view: CalendarViewName) =>
	view === 'day' ||
	view === 'threeDays' ||
	view === 'workWeek' ||
	view === 'week';
