/**
 * Colleagues in the time grid (day, 3 days, work week, week): their timed
 * entries fold into one grey background band per stretch of time, "k von n
 * belegt", so one's own day stays readable (Frank, prototype v15). Month
 * and list keep single entries; "Nebeneinander" keeps a column per person.
 */
import type { CalendarEntry } from './calendarModel';

export interface ColleagueBand {
	start: Date;
	end: Date;
	/** Ids of the colleagues busy in this stretch, in the given order. */
	busy: string[];
}

const toTime = (value: string | Date) => new Date(value).getTime();

/** Whether the time grid folds this entry into a band. */
export const foldsIntoBand = (entry: CalendarEntry, people: string[]) =>
	!entry.allDay && people.includes(entry.ownerId);

/**
 * When an entry keeps its owner busy. An all-day one covers its whole days
 * (an end stored as 23:59 counts its last day, an end at the start one
 * day), though it stays in the all-day row (review 4576368849).
 */
const busySpan = (entry: CalendarEntry): [number, number] => {
	if (!entry.allDay) return [toTime(entry.start), toTime(entry.end)];
	const from = new Date(entry.start);
	from.setHours(0, 0, 0, 0);
	const to = new Date(entry.end);
	if (
		to.getHours() ||
		to.getMinutes() ||
		to.getSeconds() ||
		to.getMilliseconds()
	)
		to.setHours(24, 0, 0, 0);
	if (to.getTime() <= from.getTime()) {
		to.setTime(from.getTime());
		to.setDate(to.getDate() + 1);
	}
	return [from.getTime(), to.getTime()];
};

/**
 * One band per stretch in which the same colleagues are busy. Adjacent
 * stretches with the same people merge; free gaps get no band. Every
 * entry of the band people counts, all-day ones included; only the timed
 * ones fold (see {@link foldsIntoBand}).
 */
export const colleagueBands = (
	entries: CalendarEntry[],
	people: string[]
): ColleagueBand[] => {
	const shown = new Set(people);
	const busy = entries
		.filter((entry) => shown.has(entry.ownerId))
		.map((entry) => {
			const [from, to] = busySpan(entry);
			return { ownerId: entry.ownerId, from, to };
		})
		.filter((entry) => entry.to > entry.from);
	const cuts = [
		...new Set(busy.flatMap((entry) => [entry.from, entry.to]))
	].sort((a, b) => a - b);
	const bands: ColleagueBand[] = [];
	for (let i = 0; i < cuts.length - 1; i += 1) {
		const from = cuts[i];
		const to = cuts[i + 1];
		const owners = new Set(
			busy
				.filter((entry) => entry.from < to && entry.to > from)
				.map((entry) => entry.ownerId)
		);
		const who = people.filter((id) => owners.has(id));
		if (who.length === 0) continue;
		const last = bands[bands.length - 1];
		if (
			last &&
			last.end.getTime() === from &&
			last.busy.join('\u0000') === who.join('\u0000')
		) {
			last.end = new Date(to);
			continue;
		}
		bands.push({ start: new Date(from), end: new Date(to), busy: who });
	}
	return bands;
};

/** A band's stretch, which names it on screen (`data-band`). */
export const bandKey = (band: ColleagueBand) =>
	`${band.start.getTime()}-${band.end.getTime()}`;

/**
 * The band of that stretch among the bands on screen now, or null when
 * there is none any more. An open band card shows this one, so moving,
 * cancelling or hiding while it is open updates or closes the card
 * (review 4601827605).
 */
export const currentBand = (
	key: string,
	bands: ColleagueBand[]
): ColleagueBand | null => bands.find((band) => bandKey(band) === key) ?? null;

/** A busy colleague of a band and what keeps them busy in it. */
export interface BandPerson {
	personId: string;
	entries: CalendarEntry[];
}

/**
 * Who is busy in a band with what, in the band's order, each person's
 * entries earliest first: the card a click on a band opens (Frank *16.2).
 * An all-day entry counts as the band counts it.
 */
export const entriesInBand = (
	band: ColleagueBand,
	entries: CalendarEntry[]
): BandPerson[] => {
	const from = band.start.getTime();
	const to = band.end.getTime();
	return band.busy.map((personId) => ({
		personId,
		entries: entries
			.filter((entry) => {
				if (entry.ownerId !== personId) return false;
				const [start, end] = busySpan(entry);
				return start < to && end > from;
			})
			.sort((a, b) => busySpan(a)[0] - busySpan(b)[0])
	}));
};
