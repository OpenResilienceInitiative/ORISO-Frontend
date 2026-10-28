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
	start: string;
	duration: number;
	modality: 'TEXT' | 'AUDIO' | 'VIDEO';
}

export interface TimelineBooking {
	id: number;
	startTime: string;
	location:
		| 'CHAT'
		| 'PHONE_CALL'
		| 'VIDEO_CALL'
		| 'IN_PERSON'
		| 'LINK'
		| 'USER_PHONE';
	/** New field the appointment service has to store (ADR-021 follow-up). */
	sessionId?: number;
}

export interface TimelineSession {
	sessionId: number;
	title: string;
	kind: EntryKind | 'mail';
	topic: string;
	lastActivity: number;
	lastMessage: string;
}

export interface FutureEntry {
	key: string;
	kind: EntryKind;
	/** The room the twin belongs to; absent = no mapping (shown without a filter only). */
	sessionId?: number;
	title: string;
	topic?: string;
	start: Date;
	modality: EntryModality;
	/** Group occurrences can be copied into a single appointment (kept from the old strip). */
	canDuplicate: boolean;
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
	const byId = new Map(sessions.map((s) => [s.sessionId, s]));
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
			modality: MODALITY_BY_OCCURRENCE[o.modality],
			canDuplicate: true
		};
	});
	const fromBookings = bookings.map<FutureEntry>((b) => {
		const session =
			b.sessionId === undefined ? undefined : byId.get(b.sessionId);
		return {
			key: `booking-${b.id}`,
			kind: 'one-to-one',
			sessionId: b.sessionId,
			title: session?.title ?? 'Beratungstermin',
			topic: session?.topic,
			start: new Date(b.startTime),
			modality: MODALITY_BY_LOCATION[b.location],
			canDuplicate: false
		};
	});
	return [...fromOccurrences, ...fromBookings]
		.filter((entry) => entry.start.getTime() > now.getTime())
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

export interface EntryMenuItem {
	key: string;
	title: string;
	description: string;
	disabled: boolean;
}

const COMING_SOON = '(kommt bald)';

/** The entry's menu, per role and kind (ADR-021 table). */
export const entryMenu = (
	entry: Pick<FutureEntry, 'kind' | 'canDuplicate'>,
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
	if (isGroup) {
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
