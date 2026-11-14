/**
 * Quick entry in the left column: "Do 14 Uhr Video", "morgen 9:00",
 * "tomorrow 2pm phone ruhiges". Reads a day, a time or range, the kind and a
 * conversation from one line, in German and English. Pure: the field only
 * shows what this found and what is still missing.
 */
import type { AppointmentKind, CalendarConversation } from './calendarModel';

export type QuickKind = AppointmentKind | 'blocker';

export interface QuickEntry {
	kind?: QuickKind;
	start?: Date;
	end?: Date;
	sessionId?: number;
	/**
	 * The line named an end ("14-15:30"). Without one, `end` is only the
	 * default length and must not replace a chosen duration.
	 */
	endGiven?: boolean;
}

/** What still has to be given before the entry can be saved. */
export type QuickEntryGap = 'when' | 'kind' | 'who';

const KIND_WORDS: [RegExp, QuickKind][] = [
	[/sperr|blocker|\bblock|pause/, 'blocker'],
	[/video/, 'video'],
	[/telefon|anruf|\btel\b|phone|\bcall\b/, 'phone'],
	[/vor[ -]?ort|präsenz|on[ -]?site|in person/, 'onsite'],
	[/\bchat\b/, 'chat']
];

const DE_WEEKDAY =
	/\b(mo|di|mi|do|fr|sa|so)(ntag|nstag|ttwoch|nnerstag|eitag|mstag|nntag|nnabend)?\b\.?/;
const EN_WEEKDAY =
	/\b(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday|s)?\b\.?/;
const DE_DAYS: Record<string, number> = {
	so: 0,
	mo: 1,
	di: 2,
	mi: 3,
	do: 4,
	fr: 5,
	sa: 6
};
const EN_DAYS: Record<string, number> = {
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6
};

const RANGE =
	/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|uhr|h)?\s*(?:-|bis|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|uhr|h)?/;
const SINGLE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|uhr|h)?(?![\d.])/;

const startOfDay = (date: Date) => {
	const day = new Date(date);
	day.setHours(0, 0, 0, 0);
	return day;
};

const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
};

const hour24 = (hour: number, suffix?: string) => {
	if (suffix === 'pm' && hour < 12) return hour + 12;
	if (suffix === 'am' && hour === 12) return 0;
	return hour;
};

const at = (day: Date, hour: number, minute: number) => {
	const date = new Date(day);
	date.setHours(hour, minute, 0, 0);
	return date;
};

export const parseQuickEntry = (
	raw: string,
	{
		now,
		conversations = [],
		kind: pickedKind
	}: {
		now: Date;
		conversations?: CalendarConversation[];
		kind?: QuickKind;
	}
): QuickEntry => {
	let text = ` ${raw.toLowerCase().replace(/[–—]/g, '-')} `;
	const out: QuickEntry = {};
	out.kind = pickedKind ?? KIND_WORDS.find(([re]) => re.test(text))?.[1];

	const today = startOfDay(now);
	let day: Date | undefined;
	const take = (match: RegExpMatchArray | null) => {
		if (match) text = text.replace(match[0], ' ');
		return match;
	};
	if (take(text.match(/übermorgen|day after tomorrow/)))
		day = addDays(today, 2);
	else if (take(text.match(/\bmorgen\b|\btomorrow\b/)))
		day = addDays(today, 1);
	else if (take(text.match(/\bheute\b|\btoday\b/))) day = today;

	const date = take(text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})?/));
	if (!day && date) {
		const year = date[3] ? Number(date[3]) : now.getFullYear();
		let candidate = new Date(year, Number(date[2]) - 1, Number(date[1]));
		if (!date[3] && candidate < today)
			candidate = new Date(
				year + 1,
				candidate.getMonth(),
				candidate.getDate()
			);
		day = candidate;
	}
	if (!day) {
		const de = text.match(DE_WEEKDAY);
		const en = text.match(EN_WEEKDAY);
		const weekday = en ? EN_DAYS[en[1]] : de ? DE_DAYS[de[1]] : undefined;
		take(en ?? de);
		if (weekday !== undefined) {
			let candidate = today;
			while (candidate.getDay() !== weekday)
				candidate = addDays(candidate, 1);
			day = candidate;
		}
	}

	const base = day ?? today;
	const range = take(text.match(RANGE));
	const single = range ? null : take(text.match(SINGLE));
	// "9:90" is no time: Date would quietly turn it into 10:30.
	if (range) {
		const startHour = hour24(Number(range[1]), range[3] ?? range[6]);
		const endHour = hour24(Number(range[4]), range[6]);
		const startMinute = Number(range[2] ?? 0);
		const endMinute = Number(range[5] ?? 0);
		if (
			startHour < 24 &&
			endHour < 24 &&
			startMinute < 60 &&
			endMinute < 60
		) {
			out.start = at(base, startHour, startMinute);
			out.end = at(base, endHour, endMinute);
			out.endGiven = true;
		}
	} else if (single) {
		const hour = hour24(Number(single[1]), single[3]);
		const minute = Number(single[2] ?? 0);
		if (hour < 24 && minute < 60) {
			out.start = at(base, hour, minute);
			out.end = new Date(
				out.start.getTime() + (out.kind === 'chat' ? 30 : 60) * 60_000
			);
		}
	}
	// "14 Uhr" without a day, already past: the next day is meant.
	if (out.start && out.end && !day && out.start < now) {
		out.start = addDays(out.start, 1);
		out.end = addDays(out.end, 1);
	}

	const words = raw
		.toLowerCase()
		.split(/[\s,]+/)
		.filter((w) => w.length >= 3);
	// An exact username wins; a partial name counts only when it fits one
	// conversation ("eule" is not "mutige_eule" when "eule" exists).
	const exact = conversations.filter((c) =>
		words.includes(c.username.toLowerCase())
	);
	const candidates =
		exact.length > 0
			? exact
			: conversations.filter((c) => {
					const name = c.username.toLowerCase();
					return words.some((w) => name.includes(w));
				});
	if (candidates.length === 1) out.sessionId = candidates[0].sessionId;
	return out;
};

/** What is missing, in the order the hint names it. */
export const quickEntryGaps = (entry: QuickEntry): QuickEntryGap[] => {
	const gaps: QuickEntryGap[] = [];
	if (!entry.start || !entry.end || entry.end <= entry.start)
		gaps.push('when');
	if (!entry.kind) gaps.push('kind');
	if (entry.kind && entry.kind !== 'blocker' && entry.sessionId === undefined)
		gaps.push('who');
	return gaps;
};

/* ------------------------------------------------------------------ */
/* Explicit fields (Frank, 2026-11-14): typing may prefill them, but     */
/* date, start and duration are what gets saved.                         */
/* ------------------------------------------------------------------ */

export const QUICK_DURATIONS = [30, 45, 60, 90] as const;
export type QuickDuration = (typeof QUICK_DURATIONS)[number];
export const DEFAULT_QUICK_DURATION: QuickDuration = 60;

export interface QuickFields {
	/** YYYY-MM-DD */
	date: string;
	/** HH:mm */
	time: string;
	duration: QuickDuration;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const dateField = (d: Date) =>
	`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const timeField = (d: Date) =>
	`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** The duration choice closest to `minutes`. */
export const nearestDuration = (minutes: number): QuickDuration =>
	QUICK_DURATIONS.reduce((best, d) =>
		Math.abs(d - minutes) < Math.abs(best - minutes) ? d : best
	);

/**
 * What a typed line prefills: only the parts it names. "Do 14 Uhr" sets
 * date and start and keeps the chosen duration; "14-15:30" also the
 * duration.
 */
export const fieldsFromEntry = (entry: QuickEntry): Partial<QuickFields> => {
	if (!entry.start) return {};
	const out: Partial<QuickFields> = {
		date: dateField(entry.start),
		time: timeField(entry.start)
	};
	if (entry.endGiven && entry.end && entry.end > entry.start)
		out.duration = nearestDuration(
			(entry.end.getTime() - entry.start.getTime()) / 60_000
		);
	return out;
};

/** Start and end from the fields; nothing when date or start is missing. */
export const rangeFromFields = ({
	date,
	time,
	duration
}: Partial<QuickFields>): { start: Date; end: Date } | undefined => {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
	const t = /^(\d{2}):(\d{2})$/.exec(time ?? '');
	if (!d || !t) return undefined;
	const start = new Date(
		Number(d[1]),
		Number(d[2]) - 1,
		Number(d[3]),
		Number(t[1]),
		Number(t[2])
	);
	const end = new Date(
		start.getTime() + (duration ?? DEFAULT_QUICK_DURATION) * 60_000
	);
	return { start, end };
};
