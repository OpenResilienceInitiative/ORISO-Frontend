/**
 * Direkteinladung (#2252): the values the shared invitation/appointment
 * dialog hands back, and the time rules of the entry page.
 */
import { DEFAULT_VALIDITY_MINUTES } from './invitationValidity';

/** Who may come in through the link (decision 8). */
export type InvitationAccess = 'guests' | 'accounts' | 'both';

export const INVITATION_ACCESS: readonly InvitationAccess[] = [
	'guests',
	'accounts',
	'both'
];

export interface InvitationSlot {
	start: Date;
	end: Date;
}

export interface InvitationLinkSettings {
	/**
	 * Minutes the link stays valid after the appointment ends. `null` without
	 * an appointment: the link then works until the counsellor deletes it.
	 */
	validityMinutes: number | null;
	access: InvitationAccess;
	/** Knock before entering (decision 11, on by default). */
	knock: boolean;
}

export interface InvitationDialogValue {
	/** `null`: a Direkteinladung without appointment. */
	appointment: InvitationSlot | null;
	/**
	 * Link settings. Always set for a Direkteinladung; for "Termin anlegen"
	 * in a 1:1 only when more people are invited by link.
	 */
	link: InvitationLinkSettings | null;
}

export const DEFAULT_LINK_SETTINGS: Readonly<{
	validityMinutes: number;
	access: InvitationAccess;
	knock: boolean;
}> = {
	validityMinutes: DEFAULT_VALIDITY_MINUTES,
	access: 'both',
	knock: true
};

/** A time as the server sends it, or already read. */
type ServerTime = string | Date | null | undefined;

const read = (value: ServerTime): number | null => {
	if (value == null) return null;
	const ms = value instanceof Date ? value.getTime() : Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
};

/**
 * What the entry page shows (decisions 7 and 10), from the server's own
 * times (`callOpensAt` = start − 15 min, `expiresAt` = end + validity):
 * - `beforeStart`: date and "In Kalender eintragen", no call yet;
 * - `open`: waiting room / call;
 * - `expired`: "Link abgelaufen" with "Neuen Link anfragen".
 */
export type InvitationEntryPhase = 'beforeStart' | 'open' | 'expired';

export const invitationEntryPhase = (
	now: Date,
	times: { callOpensAt?: ServerTime; expiresAt?: ServerTime }
): InvitationEntryPhase => {
	const expires = read(times.expiresAt);
	if (expires !== null && now.getTime() >= expires) return 'expired';
	const opens = read(times.callOpensAt);
	if (opens !== null && now.getTime() < opens) return 'beforeStart';
	return 'open';
};

/** The longest delay `setTimeout` honours; a longer one fires at once. */
export const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * How long a timer for `at` may wait now. Capped, so the caller re-arms it
 * after the cap for a time more than about 24.8 days away.
 */
export const timerDelay = (at: Date, now: Date = new Date()): number =>
	Math.min(MAX_TIMER_MS, Math.max(0, at.getTime() - now.getTime()));

export interface DayGroup<T> {
	/** Local midnight of the day. */
	day: Date;
	/** `today` / `tomorrow` for the heading, `null` shows the date. */
	relative: 'today' | 'tomorrow' | null;
	items: T[];
}

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Not yet ended, nearest first, one group per local day. */
export const groupUpcomingByDay = <T extends InvitationSlot>(
	items: readonly T[],
	now: Date
): DayGroup<T>[] => {
	const today = startOfDay(now).getTime();
	const tomorrow = startOfDay(
		new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
	).getTime();
	const groups = new Map<number, DayGroup<T>>();
	[...items]
		.filter((item) => item.end.getTime() > now.getTime())
		.sort((a, b) => a.start.getTime() - b.start.getTime())
		.forEach((item) => {
			const day = startOfDay(item.start);
			const key = day.getTime();
			const group = groups.get(key) ?? {
				day,
				relative:
					key <= today
						? 'today'
						: key === tomorrow
							? 'tomorrow'
							: null,
				items: []
			};
			group.items.push(item);
			groups.set(key, group);
		});
	return [...groups.values()];
};
