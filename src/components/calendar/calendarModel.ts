/**
 * The counsellor calendar (ADR-032, FE#1050): what one entry is, who may see
 * it, and which entries collide. Pure functions only, so Storybook, the unit
 * tests and the later UserService wiring share one set of rules.
 *
 * The shape is a draft (spec FE#2249): it is confirmed after Frank's
 * click-through acceptance in Storybook, and only then mirrored by the
 * backend.
 */
import type { EntryModality } from '../sessionsList/timeline/timelineModel';

/** ADR-032 §2a: the four kinds of a 1:1 appointment. */
export type AppointmentKind = 'onsite' | 'video' | 'phone' | 'chat';

export const APPOINTMENT_KINDS: AppointmentKind[] = [
	'video',
	'phone',
	'onsite',
	'chat'
];

/**
 * - `appointment`: a 1:1 appointment of a conversation.
 * - `group`: one date of a group chat series.
 * - `blocker`: time the counsellor blocked in ORISO.
 * - `busy`: busy time imported from the counsellor's own calendar (§5).
 */
export type CalendarEntryType = 'appointment' | 'group' | 'blocker' | 'busy';

export interface CalendarEntry {
	id: string;
	type: CalendarEntryType;
	/** ISO date-time. */
	start: string;
	/** ISO date-time. */
	end: string;
	/** Counsellor whose calendar this entry belongs to. */
	ownerId: string;
	/** Appointments only. */
	kind?: AppointmentKind;
	/**
	 * Own entries: the advice seeker's username, the group name or the
	 * blocker note. Colleague entries: the username only when the Träger
	 * allows it, otherwise absent (§3).
	 */
	title?: string;
	sessionId?: number;
	/** On-site appointments: address of the counselling centre. */
	address?: string;
}

/** The location values UserService already stores (ADR-032 §2a). */
export type AppointmentLocation =
	| 'IN_PERSON'
	| 'VIDEO_CALL'
	| 'LINK'
	| 'PHONE_CALL'
	| 'USER_PHONE'
	| 'CHAT';

const KIND_BY_LOCATION: Record<AppointmentLocation, AppointmentKind> = {
	IN_PERSON: 'onsite',
	VIDEO_CALL: 'video',
	LINK: 'video',
	PHONE_CALL: 'phone',
	USER_PHONE: 'phone',
	CHAT: 'chat'
};

export const kindFromLocation = (
	location?: string | null
): AppointmentKind | undefined =>
	location ? KIND_BY_LOCATION[location as AppointmentLocation] : undefined;

/** The timeline's glyph set, so the calendar shows the same symbols. */
export const MODALITY_BY_KIND: Record<AppointmentKind, EntryModality> = {
	onsite: 'location',
	video: 'video',
	phone: 'audio',
	chat: 'chat'
};

/** ADR-032 §3: how far a Träger lets counsellors see colleagues' calendars. */
export type CalendarVisibilityScope = 'AGENCY' | 'TENANT' | 'PLATFORM';

export interface CalendarVisibility {
	scope: CalendarVisibilityScope;
	/** "Show advice-seeker usernames" — default off. */
	showUsernames: boolean;
}

export const DEFAULT_VISIBILITY: CalendarVisibility = {
	scope: 'AGENCY',
	showUsernames: false
};

/** How a colleague relates to the signed-in counsellor. */
export type ColleagueRelation = 'sameAgency' | 'sameTenant' | 'otherTenant';

export interface Colleague {
	id: string;
	displayName: string;
	/** Name of the colleague's counselling centre. */
	agencyName: string;
	relation: ColleagueRelation;
}

const RELATIONS_IN_SCOPE: Record<CalendarVisibilityScope, ColleagueRelation[]> =
	{
		AGENCY: ['sameAgency'],
		TENANT: ['sameAgency', 'sameTenant'],
		PLATFORM: ['sameAgency', 'sameTenant', 'otherTenant']
	};

/**
 * Colleagues whose calendar the Träger's scope allows. UserService enforces
 * this; the frontend never receives the others. Storybook uses it to stand
 * in for that answer.
 */
export const colleaguesInScope = (
	colleagues: Colleague[],
	scope: CalendarVisibilityScope
) => colleagues.filter((c) => RELATIONS_IN_SCOPE[scope].includes(c.relation));

/**
 * What a colleague may see of someone else's entry (§3): time, busy and the
 * kind — plus the username if the Träger switched that on. Never a topic,
 * note, address or anything else.
 */
export const redactForColleague = (
	entry: CalendarEntry,
	visibility: CalendarVisibility
): CalendarEntry => ({
	id: entry.id,
	type: entry.type === 'busy' ? 'blocker' : entry.type,
	start: entry.start,
	end: entry.end,
	ownerId: entry.ownerId,
	kind: entry.kind,
	title:
		visibility.showUsernames && entry.type === 'appointment'
			? entry.title
			: undefined
});

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
	aStart < bEnd && bStart < aEnd;

/**
 * Own entries that collide with a proposed time. Appointments, group dates,
 * blockers and imported busy time all count; a moved entry never collides
 * with itself.
 */
export const findConflicts = (
	range: { start: Date | string; end: Date | string },
	entries: CalendarEntry[],
	ownerId: string,
	ignoreId?: string
) => {
	const start = new Date(range.start).getTime();
	const end = new Date(range.end).getTime();
	return entries.filter(
		(e) =>
			e.ownerId === ownerId &&
			e.id !== ignoreId &&
			overlaps(
				start,
				end,
				new Date(e.start).getTime(),
				new Date(e.end).getTime()
			)
	);
};

/** The next own entries from now on, for "Als Nächstes". */
export const upcomingEntries = (
	entries: CalendarEntry[],
	ownerId: string,
	now: Date,
	limit = 5
) =>
	entries
		.filter(
			(e) =>
				e.ownerId === ownerId &&
				(e.type === 'appointment' || e.type === 'group') &&
				new Date(e.end).getTime() > now.getTime()
		)
		.sort(
			(a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
		)
		.slice(0, limit);

/** The one entry that is running or starts within the next 15 minutes. */
export const SOON_MINUTES = 15;
export const isSoon = (entry: CalendarEntry, now: Date) => {
	const start = new Date(entry.start).getTime();
	const end = new Date(entry.end).getTime();
	return (
		start - now.getTime() <= SOON_MINUTES * 60_000 && end > now.getTime()
	);
};

/**
 * ADR-032 §4: what an external calendar learns about an entry through the
 * subscription link. Neutral title, time and a link that needs a login.
 */
export const neutralFeedEvent = (entry: CalendarEntry, appUrl: string) => ({
	summary: 'ORISO-Termin',
	start: entry.start,
	end: entry.end,
	url: `${appUrl.replace(/\/$/, '')}/booking/events`
});

/** Entries the signed-in person may drag to a new time. */
export const isMovable = (
	entry: CalendarEntry,
	ownerId: string,
	role: CalendarRole
) =>
	role === 'consultant' &&
	entry.ownerId === ownerId &&
	(entry.type === 'appointment' || entry.type === 'blocker');

export type CalendarRole = 'consultant' | 'asker';

/** A conversation an appointment can belong to. */
export interface CalendarConversation {
	sessionId: number;
	/** The advice seeker's username. */
	username: string;
}

export interface AppointmentDraft {
	type: 'appointment' | 'blocker';
	start: Date;
	end: Date;
	kind?: AppointmentKind;
	sessionId?: number;
	note?: string;
	/** Blockers only. */
	repeat?: BlockerRepeat;
	/** Blockers only: the whole day(s). */
	allDay?: boolean;
}

/**
 * A blocker that repeats: every chosen weekday from the first day up to and
 * including `until` (Frank, 2026-11-14: "immer montags, fortlaufend").
 * Weekdays use JavaScript numbering, 0 = Sunday, 1 = Monday.
 */
export interface BlockerRepeat {
	weekdays: number[];
	until: Date;
}

/** Upper bound so a typo in "until" cannot create years of blockers. */
export const MAX_BLOCKER_OCCURRENCES = 120;

/** Local calendar days from the date of `start` to the date of `end`. */
export const daySpan = (start: Date, end: Date) => {
	const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const to = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	// A local day has 23, 24 or 25 hours; rounding absorbs the DST hour.
	return Math.round((to.getTime() - from.getTime()) / 86_400_000);
};

const isLocalMidnight = (date: Date) =>
	date.getHours() === 0 &&
	date.getMinutes() === 0 &&
	date.getSeconds() === 0 &&
	date.getMilliseconds() === 0;

/**
 * A selection of whole days, as the month view reports it: both ends at
 * local midnight, the end exclusive.
 */
export const isWholeDays = (range: { start: Date; end: Date }) =>
	range.end.getTime() > range.start.getTime() &&
	isLocalMidnight(range.start) &&
	isLocalMidnight(range.end);

/**
 * The single time ranges of a blocker series: same clock time on every
 * chosen weekday, starting with the first day, never more than `limit`
 * (default {@link MAX_BLOCKER_OCCURRENCES}). Each end is built from its own
 * local date and the first range's end clock time, so a range keeps its
 * clock times on a 23- or 25-hour day.
 */
export const expandBlocker = (
	first: { start: Date; end: Date },
	repeat?: BlockerRepeat,
	limit = MAX_BLOCKER_OCCURRENCES
): { start: Date; end: Date }[] => {
	if (!repeat || repeat.weekdays.length === 0) return [first];
	const span = daySpan(first.start, first.end);
	// Local date plus the first range's clock time, for day `offset`.
	const at = (clock: Date, offset: number) =>
		new Date(
			first.start.getFullYear(),
			first.start.getMonth(),
			first.start.getDate() + offset,
			clock.getHours(),
			clock.getMinutes(),
			clock.getSeconds(),
			clock.getMilliseconds()
		);
	const last = new Date(repeat.until);
	last.setHours(23, 59, 59, 999);
	const out: { start: Date; end: Date }[] = [];
	let offset = 0;
	let start = at(first.start, offset);
	while (start.getTime() <= last.getTime() && out.length < limit) {
		if (repeat.weekdays.includes(start.getDay()))
			out.push({ start, end: at(first.end, offset + span) });
		offset += 1;
		start = at(first.start, offset);
	}
	return out;
};

/** Why a draft cannot be saved yet, or undefined when it can. */
export const draftError = (
	draft: Partial<AppointmentDraft>,
	now: Date
): 'incomplete' | 'past' | 'order' | 'conversation' | undefined => {
	if (!draft.start || !draft.end) return 'incomplete';
	if (draft.end.getTime() <= draft.start.getTime()) return 'order';
	if (draft.start.getTime() < now.getTime()) return 'past';
	if (draft.type === 'appointment' && draft.sessionId === undefined)
		return 'conversation';
	return undefined;
};

/**
 * What an entry move reports: `false`, a rejected promise or a promise of
 * `false` mean it was not stored and the entry goes back.
 */
export type MoveResult = void | boolean | Promise<unknown>;

/** Puts a dragged entry back when its move was refused or failed. */
export const settleMove = (result: MoveResult, revert: () => void) => {
	if (result === false) revert();
	else if (result && typeof (result as Promise<unknown>).then === 'function')
		(result as Promise<unknown>).then(
			(stored) => {
				if (stored === false) revert();
			},
			() => revert()
		);
};

const clockTime = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;

/**
 * The hours the day and week grid show: 07:00–21:00, widened to the full
 * hour around any entry outside them. An entry over midnight shows the
 * whole day. FullCalendar never shows an entry outside these hours.
 */
export const visibleHours = (
	entries: Pick<CalendarEntry, 'start' | 'end'>[],
	from = 7 * 60,
	to = 21 * 60
) => {
	let min = from;
	let max = to;
	entries.forEach((entry) => {
		const start = new Date(entry.start);
		const end = new Date(entry.end);
		if (daySpan(start, new Date(end.getTime() - 1)) > 0) {
			min = 0;
			max = 24 * 60;
			return;
		}
		const startMinutes = start.getHours() * 60 + start.getMinutes();
		const endMinutes =
			daySpan(start, end) > 0
				? 24 * 60
				: end.getHours() * 60 + end.getMinutes();
		min = Math.min(min, Math.floor(startMinutes / 60) * 60);
		max = Math.max(max, Math.ceil(endMinutes / 60) * 60);
	});
	return { min: clockTime(min), max: clockTime(max) };
};
