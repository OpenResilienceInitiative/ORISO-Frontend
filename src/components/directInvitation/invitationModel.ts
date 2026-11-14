/**
 * Direkteinladung (#2252): the values the shared invitation/appointment
 * dialog hands back, and the time rules of the entry page. Presentational
 * model only; the API mapping is checkpoint 4.
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

/** The call waiting room opens this long before the start (decision 10). */
export const WAITING_ROOM_LEAD_MINUTES = 15;

const MINUTE = 60_000;

export const waitingRoomOpensAt = (start: Date): Date =>
	new Date(start.getTime() - WAITING_ROOM_LEAD_MINUTES * MINUTE);

/** The end plus the validity: when guests lose access. */
export const invitationExpiresAt = (end: Date, validityMinutes: number): Date =>
	new Date(end.getTime() + validityMinutes * MINUTE);

/**
 * What the entry page shows (decisions 7 and 10):
 * - `beforeStart`: date and "In Kalender eintragen", no call yet;
 * - `open`: waiting room / call;
 * - `expired`: "Link abgelaufen" with "Neuen Link anfragen".
 */
export type InvitationEntryPhase = 'beforeStart' | 'open' | 'expired';

export const invitationEntryPhase = (
	now: Date,
	slot: InvitationSlot | null,
	expiresAt: Date | null
): InvitationEntryPhase => {
	if (expiresAt && now.getTime() >= expiresAt.getTime()) return 'expired';
	if (slot && now.getTime() < waitingRoomOpensAt(slot.start).getTime())
		return 'beforeStart';
	return 'open';
};

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
