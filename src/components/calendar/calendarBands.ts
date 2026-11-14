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
 * One band per stretch in which the same colleagues are busy. Adjacent
 * stretches with the same people merge; free gaps get no band.
 */
export const colleagueBands = (
	entries: CalendarEntry[],
	people: string[]
): ColleagueBand[] => {
	const busy = entries.filter(
		(entry) =>
			foldsIntoBand(entry, people) &&
			toTime(entry.end) > toTime(entry.start)
	);
	const cuts = [
		...new Set(
			busy.flatMap((entry) => [toTime(entry.start), toTime(entry.end)])
		)
	].sort((a, b) => a - b);
	const bands: ColleagueBand[] = [];
	for (let i = 0; i < cuts.length - 1; i += 1) {
		const from = cuts[i];
		const to = cuts[i + 1];
		const owners = new Set(
			busy
				.filter(
					(entry) =>
						toTime(entry.start) < to && toTime(entry.end) > from
				)
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
