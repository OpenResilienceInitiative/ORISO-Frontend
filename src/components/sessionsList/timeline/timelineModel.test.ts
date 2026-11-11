import { describe, expect, it } from 'vite-plus/test';
import {
	entryCountdown,
	formatEntryRange,
	hasEnded,
	buildFutureEntries,
	entriesForList,
	entryMenu,
	filterEntries,
	formatEntryDate,
	nextEntryBySession,
	type TimelineSession
} from './timelineModel';

const NOW = new Date('2026-10-28T10:00:00');
const sessions: TimelineSession[] = [
	{
		sessionId: 1,
		title: 'Elternrunde',
		kind: 'group',
		topic: 'Familie',
		lastActivity: 1,
		lastMessage: '',
		canConfigure: true
	},
	{
		sessionId: 2,
		title: 'ruhiges Yak Kim',
		kind: 'one-to-one',
		topic: 'Sucht',
		lastActivity: 2,
		lastMessage: ''
	}
];
const build = () =>
	buildFutureEntries({
		now: NOW,
		sessions,
		seriesToSession: { 90: 1 },
		occurrences: [
			{
				seriesId: 90,
				occurrenceIndex: 2,
				start: '2026-11-11T18:00:00',
				duration: 60,
				modality: 'VIDEO'
			},
			{
				seriesId: 90,
				occurrenceIndex: 1,
				start: '2026-11-04T18:00:00',
				duration: 60,
				modality: 'VIDEO'
			},
			{
				seriesId: 90,
				occurrenceIndex: 0,
				start: '2026-10-21T18:00:00',
				duration: 60,
				modality: 'VIDEO'
			}
		],
		bookings: [
			{
				id: 7,
				startTime: '2026-10-29T17:00:00',
				location: 'PHONE_CALL',
				sessionId: 2
			},
			{ id: 8, startTime: '2026-10-30T09:00:00', location: 'IN_PERSON' }
		]
	});

describe('future entries', () => {
	it('keeps one entry per upcoming date, nearest first, past ones dropped', () => {
		expect(build().map((e) => e.key)).toEqual([
			'booking-7',
			'booking-8',
			'occ-90-1',
			'occ-90-2'
		]);
	});

	it('maps modality and the room', () => {
		const [phone, onSite, group] = build();
		expect(phone.modality).toBe('audio');
		expect(phone.sessionId).toBe(2);
		expect(onSite.modality).toBe('location');
		expect(group.title).toBe('Elternrunde');
		expect(group.modality).toBe('video');
		expect(group.canConfigure).toBe(true);
	});

	it('shows an entry without a room only when no filter is on', () => {
		const entries = build();
		expect(filterEntries(entries, 'all')).toHaveLength(4);
		expect(filterEntries(entries, 'one-to-one').map((e) => e.key)).toEqual([
			'booking-7'
		]);
		expect(filterEntries(entries, 'group')).toHaveLength(2);
	});
});

describe('what the actions need', () => {
	it('keeps the original start of a date and the cal.com handles of a booking', () => {
		const [phone, , group] = build();
		expect(group.occurrence).toEqual({
			seriesId: 90,
			originalStart: '2026-11-04T18:00:00',
			duration: 60,
			modality: 'VIDEO'
		});
		expect(phone.booking?.id).toBe(7);
	});

	it('a group the counsellor does not moderate offers no changes', () => {
		const items = entryMenu(
			{ kind: 'group', canDuplicate: false, canModerate: false },
			'counsellor'
		);
		expect(items.map((i) => i.key)).toEqual(['reminder']);
	});
});

describe('next appointment per room', () => {
	it('keeps the nearest date of every room, skips entries without a room', () => {
		const next = nextEntryBySession(build());
		expect([...next.keys()].sort()).toEqual([1, 2]);
		expect(next.get(1)?.key).toBe('occ-90-1');
		expect(next.get(2)?.key).toBe('booking-7');
	});
});

describe('entry date', () => {
	it('writes "Mi 4. Nov 18:00"', () => {
		expect(formatEntryDate(new Date('2026-11-04T18:00:00'))).toBe(
			'Mi 4. Nov 18:00'
		);
	});
});

describe('entry menu', () => {
	const keys = (kind: 'group' | 'one-to-one', role: 'counsellor' | 'asker') =>
		entryMenu(
			{
				kind,
				canDuplicate: kind === 'group',
				canConfigure: kind === 'group'
			},
			role
		).map((i) => `${i.key}${i.disabled ? '*' : ''}`);

	it('counsellor, group', () => {
		expect(keys('group', 'counsellor')).toEqual([
			'edit*',
			'cancel',
			'duplicate',
			'configure',
			'reminder*'
		]);
	});

	it('allows date cancellation but withholds group configuration for a co-moderator', () => {
		const items = entryMenu(
			{
				kind: 'group',
				canModerate: true,
				canDuplicate: true,
				canConfigure: false
			},
			'counsellor'
		);
		expect(items.find(({ key }) => key === 'cancel')?.disabled).toBe(false);
		expect(items.some(({ key }) => key === 'configure')).toBe(false);
	});

	it('counsellor, 1:1 reschedules instead of editing', () => {
		expect(keys('one-to-one', 'counsellor')).toEqual([
			'reschedule',
			'cancel',
			'reminder*'
		]);
	});

	it('asker may cancel a 1:1 but not a group date yet', () => {
		expect(keys('one-to-one', 'asker')).toEqual(['reminder*', 'cancel']);
		expect(keys('group', 'asker')).toEqual(['reminder*', 'cancel*']);
	});
});

describe('entries in the real list', () => {
	const entry = (key: string, sessionId?: number, kind = 'group') =>
		({ key, sessionId, kind }) as any;
	const all = [
		entry('own-group', 1),
		entry('hidden-group', 2),
		entry('booking', undefined, 'one-to-one')
	];

	it('a group date shows only while its room is a visible row', () => {
		expect(
			entriesForList(all, new Set(['group:1']), false).map((e) => e.key)
		).toEqual(['own-group', 'booking']);
	});

	it('a date without a room shows only without filter or search', () => {
		expect(
			entriesForList(all, new Set(['group:1', 'group:2']), true).map(
				(e) => e.key
			)
		).toEqual(['own-group', 'hidden-group']);
	});

	it('a 1:1 twin follows its conversation through a filter', () => {
		const twin = [entry('twin', 7, 'one-to-one')];
		const shown = (rooms: string[], hasFilter: boolean) =>
			entriesForList(twin, new Set(rooms), hasFilter).length;
		expect(shown(['one-to-one:7'], true)).toBe(1);
		expect(shown([], true)).toBe(0);
		// Its conversation is not loaded yet: not lost while nothing filters.
		expect(shown([], false)).toBe(1);
		// A group with the same id is another room.
		expect(shown(['group:7'], true)).toBe(0);
	});

	it('maps a 1:1 appointment to its conversation, not a group with that id', () => {
		const [twin] = buildFutureEntries({
			now: NOW,
			occurrences: [],
			seriesToSession: {},
			sessions: [
				{ ...sessions[0], sessionId: 7, title: 'Gruppe' },
				{ ...sessions[1], sessionId: 7, matrixRoomId: '!a:b' }
			],
			bookings: [
				{
					id: 'u-1',
					appointmentId: 'u-1',
					sessionId: 7,
					startTime: '2026-10-29T10:00:00Z',
					location: 'CHAT'
				}
			]
		});
		expect(twin.title).toBe('ruhiges Yak Kim');
		expect(twin.matrixRoomId).toBe('!a:b');
		expect(twin.booking?.appointmentId).toBe('u-1');
	});

	it('nobody but the counsellor of a room gets its change actions', () => {
		const items = entryMenu(
			{ kind: 'one-to-one', canDuplicate: false, canModerate: false },
			'counsellor'
		);
		expect(items.map((i) => i.key)).toEqual(['reminder']);
	});
});

describe('pill time and countdown', () => {
	const now = new Date('2026-10-28T10:00:00');
	const inMinutes = (minutes: number) =>
		new Date(now.getTime() + minutes * 60_000);

	it('leaves out the day today and names it on any other day', () => {
		expect(
			formatEntryRange({ start: inMinutes(30), end: inMinutes(90) }, now)
		).toBe('10:30–11:30');
		expect(
			formatEntryRange(
				{
					start: new Date('2026-10-30T18:00:00'),
					end: new Date('2026-10-30T19:00:00')
				},
				now
			)
		).toBe('Fr 30. Okt 18:00–19:00');
	});

	it('turns red from five minutes before and runs on as "läuft"', () => {
		expect(entryCountdown({ start: inMinutes(6) }, now).soon).toBe(false);
		expect(entryCountdown({ start: inMinutes(5) }, now).soon).toBe(true);
		expect(entryCountdown({ start: inMinutes(-1) }, now)).toEqual({
			running: true,
			soon: true
		});
	});

	it('counts calendar days: late tonight is hours, past midnight "morgen"', () => {
		expect(
			entryCountdown({ start: new Date('2026-10-28T22:00:00') }, now)
				.label
		).toBe('in 12 Std.');
		expect(
			entryCountdown({ start: new Date('2026-10-29T01:00:00') }, now)
				.label
		).toBe('morgen');
		expect(
			entryCountdown({ start: new Date('2026-11-02T09:00:00') }, now)
				.label
		).toBe('in 5 Tagen');
	});

	it('keeps a running appointment until its end', () => {
		const running = { start: inMinutes(-10), end: inMinutes(50) };
		expect(hasEnded(running, now)).toBe(false);
		expect(
			hasEnded({ start: inMinutes(-10), end: inMinutes(-1) }, now)
		).toBe(true);
		expect(hasEnded({ start: inMinutes(-1) }, now)).toBe(true);
	});
});
