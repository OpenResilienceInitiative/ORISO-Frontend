/**
 * Free time in the counsellor calendar: the pills under quick entry
 * ("Nächste freie Stunde") and the time everyone is free in the side-by-side
 * view. Day exceptions and public holidays count. Pure, so the unit tests
 * pin the rules.
 */
import type { CalendarEntry } from './calendarModel';
import {
	FALLBACK_DAY,
	effectiveDay,
	minutesOf,
	type WorkingHours,
	type WorkingPlan
} from './calendarWorkingHours';

/** The weekly list, or the full plan with exceptions and holidays. */
type Hours = WorkingHours | WorkingPlan;

export interface TimeRange {
	start: Date;
	end: Date;
}

const MINUTE = 60_000;
/** Free time starts on the next half hour, never at "now" itself. */
const STEP_MINUTES = 30;

const atTime = (day: Date, time: string) => {
	const at = new Date(day);
	const minutes = minutesOf(time);
	at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return at;
};

const startOfDay = (date: Date) => {
	const day = new Date(date);
	day.setHours(0, 0, 0, 0);
	return day;
};

const roundUp = (date: Date, minutes: number) =>
	new Date(Math.ceil(date.getTime() / (minutes * MINUTE)) * minutes * MINUTE);

/**
 * The windows to search on a day: its working hours (a day exception
 * first, a public holiday of the region has none), or 08:00–18:00 when
 * none are set at all. A day without hours while others have them is free
 * of work, so it has no window.
 */
export const searchWindows = (day: Date, hours: Hours): TimeRange[] => {
	const effective = effectiveDay(day, hours);
	const windows =
		effective.source === 'none' ? [FALLBACK_DAY] : effective.windows;
	return windows.map((w) => ({
		start: atTime(day, w.start),
		end: atTime(day, w.end)
	}));
};

/**
 * The gaps of at least `minMinutes` inside the day's windows that none of
 * `busy` covers. On today the search starts at the next half hour.
 */
export const freeGaps = ({
	busy,
	day,
	hours,
	now,
	minMinutes = STEP_MINUTES
}: {
	busy: TimeRange[];
	day: Date;
	hours: Hours;
	now: Date;
	minMinutes?: number;
}): TimeRange[] => {
	const earliest = roundUp(now, STEP_MINUTES);
	const sorted = [...busy].sort(
		(a, b) => a.start.getTime() - b.start.getTime()
	);
	const gaps: TimeRange[] = [];
	for (const window of searchWindows(startOfDay(day), hours)) {
		let from =
			earliest.getTime() > window.start.getTime()
				? earliest
				: window.start;
		for (const range of sorted) {
			if (range.end <= from || range.start >= window.end) continue;
			if (range.start.getTime() - from.getTime() >= minMinutes * MINUTE)
				gaps.push({ start: from, end: range.start });
			if (range.end > from) from = range.end;
		}
		if (window.end.getTime() - from.getTime() >= minMinutes * MINUTE)
			gaps.push({ start: from, end: window.end });
	}
	return gaps;
};

const busyOf = (entries: CalendarEntry[], people: string[]): TimeRange[] =>
	entries
		.filter((e) => people.includes(e.ownerId))
		.map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
		.filter((r) => r.end > r.start);

/**
 * "Nächste freie Stunde": the first free hour of each of the next working
 * days, at most `count`, looking `days` ahead (Frank's prototype).
 */
export const nextFreeHours = ({
	entries,
	ownerId,
	hours,
	now,
	count = 3,
	days = 7,
	minutes = 60
}: {
	entries: CalendarEntry[];
	ownerId: string;
	hours: Hours;
	now: Date;
	count?: number;
	days?: number;
	minutes?: number;
}): Date[] => {
	const busy = busyOf(entries, [ownerId]);
	const out: Date[] = [];
	for (let i = 0; i < days && out.length < count; i++) {
		const day = startOfDay(now);
		day.setDate(day.getDate() + i);
		const gap = freeGaps({
			busy,
			day,
			hours,
			now,
			minMinutes: minutes
		})[0];
		if (gap) out.push(gap.start);
	}
	return out;
};

/**
 * Side by side: the time on `day` in which every shown person is free,
 * within the signed-in counsellor's working hours.
 */
export const freeForEveryone = ({
	entries,
	people,
	day,
	hours,
	now
}: {
	entries: CalendarEntry[];
	people: string[];
	day: Date;
	hours: Hours;
	now: Date;
}): TimeRange[] => freeGaps({ busy: busyOf(entries, people), day, hours, now });
