/**
 * Pure model of the chat-history timeline prototype (ADR-021): how planned
 * appointments (group series occurrences, 1:1 bookings) become "twin"
 * entries in the future part of the list, which of them a filter shows, and
 * what their menu offers. No React, no DOM.
 */

export type EntryModality = 'chat' | 'audio' | 'video' | 'location';
export type EntryKind = 'group' | 'one-to-one';
export type TimelineRole = 'counsellor' | 'asker';
export type TimelineFilter = 'all' | EntryKind;

/** Real API shapes (`ChatOccurrence`, `BookingEventsInterface`), trimmed to what the list needs. */
export interface TimelineOccurrence {
	seriesId: number;
	occurrenceIndex: number;
	/** Identifies the date when it is skipped (`apiSkipChatOccurrence`). */
	originalStart?: string;
	start: string;
	duration: number;
	modality: 'TEXT' | 'AUDIO' | 'VIDEO';
}

export interface TimelineBooking {
	id: number | string;
	/** Set on an appointment stored on its conversation (FE#1960): cancel and move use it. */
	appointmentId?: string;
	startTime: string;
	endTime?: string;
	location:
		| 'CHAT'
		| 'PHONE_CALL'
		| 'VIDEO_CALL'
		| 'IN_PERSON'
		| 'LINK'
		| 'USER_PHONE';
	/** The conversation the appointment belongs to. */
	sessionId?: number;
	/** cal.com booking uid (cancel). */
	uid?: string;
	/** cal.com path (reschedule). */
	rescheduleLink?: string;
	askerId?: string;
	askerName?: string;
	title?: string;
}

export interface TimelineSession {
	sessionId: number;
	title: string;
	kind: EntryKind | 'mail';
	topic: string;
	lastActivity: number;
	lastMessage: string;
	/** Room of the session (opening and configuring the group). */
	matrixRoomId?: string;
	/** False when the viewer may not change this group's dates. */
	canModerate?: boolean;
	/** The viewer may open the owner-only group settings editor. */
	canConfigure?: boolean;
}

export interface FutureEntry {
	key: string;
	kind: EntryKind;
	/** The room the twin belongs to; absent = no mapping (shown without a filter only). */
	sessionId?: number;
	title: string;
	topic?: string;
	start: Date;
	/** Absent: the source names no end, the entry leaves at its start. */
	end?: Date;
	modality: EntryModality;
	/** Group occurrences can be copied into a single appointment (kept from the old strip). */
	canDuplicate: boolean;
	/** False: the viewer may not change this group date (menu shows only what is open to all). */
	canModerate?: boolean;
	/** The viewer may open the owner-only group settings editor. */
	canConfigure?: boolean;
	matrixRoomId?: string;
	/** What the menu actions need from the source record. */
	occurrence?: {
		seriesId: number;
		originalStart: string;
		duration: number;
		modality: TimelineOccurrence['modality'];
	};
	booking?: {
		id: number | string;
		appointmentId?: string;
		uid?: string;
		rescheduleLink?: string;
		askerId?: string;
	};
}

const MODALITY_BY_OCCURRENCE: Record<
	TimelineOccurrence['modality'],
	EntryModality
> = { TEXT: 'chat', AUDIO: 'audio', VIDEO: 'video' };

const MODALITY_BY_LOCATION: Record<TimelineBooking['location'], EntryModality> =
	{
		CHAT: 'chat',
		PHONE_CALL: 'audio',
		USER_PHONE: 'audio',
		VIDEO_CALL: 'video',
		LINK: 'video',
		IN_PERSON: 'location'
	};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** A running appointment stays above "Jetzt" until it is over. */
export const hasEnded = (
	entry: Pick<FutureEntry, 'start' | 'end'>,
	now: Date
): boolean => (entry.end ?? entry.start).getTime() <= now.getTime();

export const buildFutureEntries = ({
	now,
	occurrences,
	bookings,
	seriesToSession,
	sessions
}: {
	now: Date;
	occurrences: TimelineOccurrence[];
	bookings: TimelineBooking[];
	/** `ChatOccurrence.seriesId` → the group's session id. */
	seriesToSession: Record<number, number>;
	sessions: TimelineSession[];
}): FutureEntry[] => {
	// Group and 1:1 ids come from different tables and may be equal.
	const byId = new Map(
		sessions.filter((s) => s.kind === 'group').map((s) => [s.sessionId, s])
	);
	const conversationById = new Map(
		sessions.filter((s) => s.kind !== 'group').map((s) => [s.sessionId, s])
	);
	const fromOccurrences = occurrences.map<FutureEntry>((o) => {
		const sessionId = seriesToSession[o.seriesId];
		const session =
			sessionId === undefined ? undefined : byId.get(sessionId);
		return {
			key: `occ-${o.seriesId}-${o.occurrenceIndex}`,
			kind: 'group',
			sessionId,
			title: session?.title ?? 'Gruppentermin',
			topic: session?.topic,
			start: new Date(o.start),
			end: new Date(new Date(o.start).getTime() + o.duration * MINUTE),
			modality: MODALITY_BY_OCCURRENCE[o.modality],
			canDuplicate: session?.canModerate !== false,
			canModerate: session?.canModerate,
			canConfigure: session?.canConfigure,
			matrixRoomId: session?.matrixRoomId,
			occurrence: {
				seriesId: o.seriesId,
				originalStart: o.originalStart ?? o.start,
				duration: o.duration,
				modality: o.modality
			}
		};
	});
	const fromBookings = bookings.map<FutureEntry>((b) => {
		const session =
			b.sessionId === undefined
				? undefined
				: conversationById.get(b.sessionId);
		return {
			key: `booking-${b.id}`,
			kind: 'one-to-one',
			sessionId: b.sessionId,
			title:
				session?.title ?? b.askerName ?? b.title ?? 'Beratungstermin',
			topic: session?.topic,
			start: new Date(b.startTime),
			end: b.endTime ? new Date(b.endTime) : undefined,
			modality: MODALITY_BY_LOCATION[b.location] ?? 'video',
			canDuplicate: false,
			canModerate: session?.canModerate,
			matrixRoomId: session?.matrixRoomId,
			booking: {
				id: b.id,
				appointmentId: b.appointmentId,
				uid: b.uid,
				rescheduleLink: b.rescheduleLink,
				askerId: b.askerId
			}
		};
	});
	return [...fromOccurrences, ...fromBookings]
		.filter((entry) => !hasEnded(entry, now))
		.sort((a, b) => a.start.getTime() - b.start.getTime());
};

/** An entry without a mapped room only shows when no filter is active. */
export const filterEntries = (
	entries: FutureEntry[],
	filter: TimelineFilter
): FutureEntry[] =>
	filter === 'all'
		? entries
		: entries.filter(
				(entry) =>
					entry.sessionId !== undefined && entry.kind === filter
			);

/** Group and 1:1 ids may be equal: a room is its kind plus its id. */
export const roomKey = (kind: EntryKind, sessionId: number) =>
	`${kind}:${sessionId}`;

/**
 * What the real list shows above "Jetzt": a filter applies to both sides of
 * the handle, so a twin shows only while its room is a visible row. A group
 * date always has its row. A 1:1 appointment may belong to a conversation the
 * list has not loaded yet, so without its row (like an appointment without a
 * room) it shows only while no filter or search is active.
 */
export const entriesForList = (
	entries: FutureEntry[],
	visibleRooms: ReadonlySet<string>,
	hasFilter: boolean
): FutureEntry[] =>
	entries.filter((entry) => {
		if (
			entry.sessionId !== undefined &&
			visibleRooms.has(roomKey(entry.kind, entry.sessionId))
		)
			return true;
		return entry.kind === 'one-to-one' && !hasFilter;
	});

/**
 * The nearest appointment of every room: drives the clock circle on the
 * room's card and the line below its header. Entries are sorted, so the
 * first one per room wins.
 */
export const nextEntryBySession = (
	entries: FutureEntry[]
): Map<number, FutureEntry> => {
	const next = new Map<number, FutureEntry>();
	for (const entry of entries) {
		if (entry.sessionId !== undefined && !next.has(entry.sessionId))
			next.set(entry.sessionId, entry);
	}
	return next;
};

const stripDot = (text: string) => text.replace(/\./g, '');

/** "Mo 13. Dez 18:00" */
export const formatEntryDate = (start: Date, locale = 'de-DE'): string => {
	const weekday = stripDot(
		new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(start)
	);
	const month = stripDot(
		new Intl.DateTimeFormat(locale, { month: 'short' }).format(start)
	);
	const time = new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(start);
	return `${weekday} ${start.getDate()}. ${month} ${time}`;
};

const clockTime = (date: Date, locale: string) =>
	new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(date);

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Fr 30. Okt 18:00–19:00" (Figma: the button on a card names the whole slot). */
export const formatEntrySlot = (
	entry: Pick<FutureEntry, 'start' | 'end'>,
	locale = 'de-DE'
): string =>
	`${formatEntryDate(entry.start, locale)}${
		entry.end ? `–${clockTime(entry.end, locale)}` : ''
	}`;

/** "18:00–19:00" today, the whole slot on any other day. */
export const formatEntryRange = (
	entry: Pick<FutureEntry, 'start' | 'end'>,
	now: Date,
	locale = 'de-DE'
): string =>
	startOfDay(entry.start) === startOfDay(now)
		? `${clockTime(entry.start, locale)}${
				entry.end ? `–${clockTime(entry.end, locale)}` : ''
			}`
		: formatEntrySlot(entry, locale);

/** Below this many minutes an appointment turns red. */
export const SOON_MINUTES = 5;

export interface EntryCountdown {
	/** "in 5 Min.", "morgen", "in 3 Tagen"; absent while it is running. */
	label?: string;
	running: boolean;
	soon: boolean;
}

/** Whole calendar days count, so tonight is never "morgen" and vice versa. */
export const entryCountdown = (
	entry: Pick<FutureEntry, 'start'>,
	now: Date,
	locale = 'de-DE'
): EntryCountdown => {
	const ms = entry.start.getTime() - now.getTime();
	if (ms <= 0) return { running: true, soon: true };
	const relative = new Intl.RelativeTimeFormat(locale, {
		numeric: 'auto',
		style: 'short'
	});
	const minutes = Math.ceil(ms / MINUTE);
	const days = Math.round((startOfDay(entry.start) - startOfDay(now)) / DAY);
	let label: string;
	if (minutes < 60) label = relative.format(minutes, 'minute');
	else if (days === 0)
		label = relative.format(Math.round(minutes / 60), 'hour');
	else label = relative.format(days, 'day');
	return { label, running: false, soon: minutes <= SOON_MINUTES };
};

export interface EntryMenuItem {
	key: string;
	title: string;
	description: string;
	disabled: boolean;
}

const COMING_SOON = '(kommt bald)';

/** The entry's menu, per role and kind (ADR-021 table). */
export const entryMenu = (
	entry: Pick<
		FutureEntry,
		'kind' | 'canDuplicate' | 'canModerate' | 'canConfigure'
	>,
	role: TimelineRole
): EntryMenuItem[] => {
	const isGroup = entry.kind === 'group';
	if (role === 'asker') {
		return [
			{
				key: 'reminder',
				title: 'Erinnerung',
				description: `Vor dem Termin erinnert werden ${COMING_SOON}`,
				disabled: true
			},
			isGroup
				? {
						key: 'cancel',
						title: 'Gruppentermin absagen',
						description: `Nur diesen Termin absagen ${COMING_SOON}`,
						disabled: true
					}
				: {
						key: 'cancel',
						title: '1:1 absagen',
						description: 'Diesen Beratungstermin absagen.',
						disabled: false
					}
		];
	}
	if (entry.canModerate === false) {
		// Not this counsellor's room: only what is open to every member.
		return [
			{
				key: 'reminder',
				title: 'Erinnerung einstellen',
				description: `Wie früh und wie aufdringlich ${COMING_SOON}`,
				disabled: true
			}
		];
	}
	const items: EntryMenuItem[] = [
		isGroup
			? {
					key: 'edit',
					title: 'Diesen Termin bearbeiten',
					description: `Nur dieser Termin, nicht die Serie ${COMING_SOON}`,
					disabled: true
				}
			: {
					key: 'reschedule',
					title: 'Termin verschieben',
					description: 'Neuen Zeitpunkt wählen.',
					disabled: false
				},
		{
			key: 'cancel',
			title: 'Termin absagen',
			description: 'Nur diesen Termin absagen.',
			disabled: false
		}
	];
	if (entry.canDuplicate) {
		items.push({
			key: 'duplicate',
			title: 'Als Einzeltermin duplizieren',
			description: 'Diesen Termin einzeln übernehmen.',
			disabled: false
		});
	}
	if (isGroup && entry.canConfigure === true) {
		items.push({
			key: 'configure',
			title: 'Gruppe konfigurieren',
			description: 'Thema, Zeitplan und Moderation ändern.',
			disabled: false
		});
	}
	items.push({
		key: 'reminder',
		title: 'Erinnerung einstellen',
		description: `Wie früh und wie aufdringlich ${COMING_SOON}`,
		disabled: true
	});
	return items;
};
