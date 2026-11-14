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
	listTwoWeeks: { type: 'list', duration: { weeks: 2 } }
};

export type ViewSwitcherStyle = 'menu' | 'digits';

export const isTimeGrid = (view: CalendarViewName) =>
	view === 'day' ||
	view === 'threeDays' ||
	view === 'workWeek' ||
	view === 'week';
