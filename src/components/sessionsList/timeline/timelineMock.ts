import {
	buildFutureEntries,
	type TimelineBooking,
	type TimelineOccurrence,
	type TimelineSession
} from './timelineModel';

/** Fixed "now", so the stories do not move with the calendar. */
export const MOCK_NOW = new Date('2026-10-28T10:00:00');

export const mockSessions: TimelineSession[] = [
	{
		sessionId: 5601,
		title: 'Elternrunde',
		kind: 'group',
		topic: 'Familie',
		lastActivity: 6,
		lastMessage: 'Danke für die offene Runde gestern.'
	},
	{
		sessionId: 4401,
		title: 'ruhiges Yak Kim',
		kind: 'one-to-one',
		topic: 'Familienberatung',
		lastActivity: 5,
		lastMessage: 'Bis Donnerstag, ich bringe die Unterlagen mit.'
	},
	{
		sessionId: 5604,
		title: 'Selbsthilfe Mitte',
		kind: 'group',
		topic: 'Sucht',
		lastActivity: 4,
		lastMessage: 'Wer kann beim nächsten Mal moderieren?'
	},
	{
		sessionId: 4402,
		title: 'mutiger Fuchs',
		kind: 'one-to-one',
		topic: 'Schulden',
		lastActivity: 3,
		lastMessage: 'Ich habe den Brief gestern bekommen.'
	},
	{
		sessionId: 4403,
		title: 'Anfrage per Mail',
		kind: 'mail',
		topic: 'Allgemein',
		lastActivity: 2,
		lastMessage: 'Anfrage gesendet'
	}
];

const weekly = (
	seriesId: number,
	firstStart: string,
	count: number,
	modality: TimelineOccurrence['modality']
): TimelineOccurrence[] =>
	Array.from({ length: count }, (_, index) => {
		const start = new Date(firstStart);
		start.setDate(start.getDate() + index * 7);
		return {
			seriesId,
			occurrenceIndex: index,
			start: start.toISOString(),
			duration: 60,
			modality
		};
	});

/** Two group series: ten dates for the parents' round, six for the self-help group. */
export const mockOccurrences: TimelineOccurrence[] = [
	...weekly(9001, '2026-10-30T18:00:00', 10, 'VIDEO'),
	...weekly(9002, '2026-11-02T17:30:00', 6, 'TEXT')
];

export const mockSeriesToSession: Record<number, number> = {
	9001: 5601,
	9002: 5604
};

export const mockBookings: TimelineBooking[] = [
	{
		id: 7001,
		startTime: '2026-10-29T16:00:00',
		location: 'VIDEO_CALL',
		sessionId: 4401
	},
	{
		id: 7002,
		startTime: '2026-11-05T11:00:00',
		location: 'PHONE_CALL',
		sessionId: 4402
	},
	// No room known yet: shows only without a filter.
	{ id: 7003, startTime: '2026-11-06T09:30:00', location: 'IN_PERSON' }
];

export const mockEntries = (
	occurrences: TimelineOccurrence[] = mockOccurrences,
	bookings: TimelineBooking[] = mockBookings
) =>
	buildFutureEntries({
		now: MOCK_NOW,
		occurrences,
		bookings,
		seriesToSession: mockSeriesToSession,
		sessions: mockSessions
	});
