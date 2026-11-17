/**
 * Direkteinladung (#2252): the values the shared invitation/appointment
 * dialog hands back, and the time rules of the entry page.
 */
import { calendarLocale } from '../calendar/calendarLocale';
import type { AppointmentKind } from '../calendar/calendarModel';
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';
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
	/** The Art, when the door asks it (`withKind`). */
	kind?: AppointmentKind;
	/** The conversation, when the door asks it (the calendar). */
	sessionId?: number;
	/** Fields actually changed by an edit; omitted when creating. */
	changed?: {
		appointment: boolean;
		validityMinutes: boolean;
		access: boolean;
		knock: boolean;
	};
}

/**
 * What another door already knows when it hands over to the Direkteinladung
 * of "Chat erstellen": the calendar's "Neue Person per Direkteinladung …"
 * passes its slot and Art, so the invitation opens with that appointment.
 */
export interface InvitationPreset extends InvitationSlot {
	kind?: AppointmentKind;
}

/**
 * The link medium for an Art. "Vor Ort" meets in person; its link opens the
 * chat. "Telefon" is an ORISO audio call.
 */
export const MEDIUM_FOR_KIND: Readonly<
	Record<AppointmentKind, DirectLinkMedium>
> = {
	video: 'VIDEO',
	phone: 'AUDIO',
	chat: 'CHAT',
	onsite: 'CHAT'
};

/** The location state "Chat erstellen" reads its preset from. */
export interface InvitationPresetState {
	invitationPreset?: { start: string; end: string; kind?: AppointmentKind };
}

/** A preset as router state (plain values; dates as ISO strings). */
export const toInvitationPresetState = (
	preset: InvitationPreset
): InvitationPresetState => ({
	invitationPreset: {
		start: preset.start.toISOString(),
		end: preset.end.toISOString(),
		...(preset.kind ? { kind: preset.kind } : {})
	}
});

/** The preset back from router state; anything unreadable is no preset. */
export const fromInvitationPresetState = (
	state: unknown
): InvitationPreset | undefined => {
	const raw = (state as InvitationPresetState | null | undefined)
		?.invitationPreset;
	if (!raw) return undefined;
	const start = new Date(raw.start);
	const end = new Date(raw.end);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
		return undefined;
	if (end.getTime() <= start.getTime()) return undefined;
	return {
		start,
		end,
		...(raw.kind && raw.kind in MEDIUM_FOR_KIND ? { kind: raw.kind } : {})
	};
};

/** "Mo., 16. Nov., 14:00–15:00" in the UI language (de@informal too). */
export const formatPresetRange = (slot: InvitationSlot, language: string) => {
	const locale = calendarLocale(language);
	const day = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	}).format(slot.start);
	const time = new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	});
	return `${day}, ${time.format(slot.start)}–${time.format(slot.end)}`;
};

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

/**
 * Not yet ended (or, for an invitation, its link still works after the
 * end: share, QR and edit stay reachable until `expiresAt`), nearest
 * first, one group per local day.
 */
export const groupUpcomingByDay = <
	T extends InvitationSlot & { expiresAt?: Date }
>(
	items: readonly T[],
	now: Date
): DayGroup<T>[] => {
	const today = startOfDay(now).getTime();
	const tomorrow = startOfDay(
		new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
	).getTime();
	const groups = new Map<number, DayGroup<T>>();
	[...items]
		.filter(
			(item) =>
				Math.max(item.end.getTime(), item.expiresAt?.getTime() ?? 0) >
				now.getTime()
		)
		.sort((a, b) => a.start.getTime() - b.start.getTime())
		.forEach((item) => {
			const day = startOfDay(item.start);
			const key = day.getTime();
			const group = groups.get(key) ?? {
				day,
				relative:
					key === today
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
