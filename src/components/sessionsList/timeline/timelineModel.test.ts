import { describe, expect, it } from 'vite-plus/test';
import {
	buildFutureEntries,
	entryMenu,
	filterEntries,
	formatEntryDate,
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
		lastMessage: ''
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

describe('entry date', () => {
	it('writes "Mi 4. Nov 18:00"', () => {
		expect(formatEntryDate(new Date('2026-11-04T18:00:00'))).toBe(
			'Mi 4. Nov 18:00'
		);
	});
});

describe('entry menu', () => {
	const keys = (kind: 'group' | 'one-to-one', role: 'counsellor' | 'asker') =>
		entryMenu({ kind, canDuplicate: kind === 'group' }, role).map(
			(i) => `${i.key}${i.disabled ? '*' : ''}`
		);

	it('counsellor, group', () => {
		expect(keys('group', 'counsellor')).toEqual([
			'edit*',
			'cancel',
			'duplicate',
			'configure',
			'reminder*'
		]);
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
