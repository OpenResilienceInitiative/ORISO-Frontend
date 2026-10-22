import { describe, expect, it } from 'vitest';
import {
	latestActivityInRoom,
	selectActivityEventsSeenWhileReading
} from './seenWhileReading';

const ROOM = '!r1:x';

const event = (
	id: string,
	createdAt: string,
	extra: Record<string, unknown> = {}
): any => ({
	id,
	eventType: 'message.new',
	category: 'message',
	createdAt,
	readAt: null,
	params: { roomRef: ROOM },
	...extra
});

const select = (feed: any[], since: string | null, unreadOnly = false) =>
	selectActivityEventsSeenWhileReading({
		feed,
		visibleRoomId: ROOM,
		since,
		unreadOnly
	});

describe('D1: activity events seen while reading (#1824)', () => {
	const opened = '2026-10-22T10:00:00Z';

	it('selects unread message events of the visible room that arrived after opening', () => {
		const feed = [
			event('new', '2026-10-22T10:01:00Z'),
			event('before', '2026-10-22T09:59:00Z'),
			event('same', opened),
			event('read', '2026-10-22T10:02:00Z', { readAt: opened }),
			event('otherRoom', '2026-10-22T10:02:00Z', {
				params: { roomRef: '!r2:x' }
			}),
			event('system', '2026-10-22T10:02:00Z', {
				eventType: 'supervisor.added',
				category: 'system'
			})
		];
		expect(select(feed, opened)).toEqual(['new']);
	});

	it('never marks older events loaded later (paging)', () => {
		expect(
			select([event('older', '2026-10-01T08:00:00Z')], opened)
		).toEqual([]);
	});

	it('marks nothing without a baseline or under "unread only" (#845)', () => {
		const feed = [event('new', '2026-10-22T10:01:00Z')];
		expect(select(feed, null)).toEqual([]);
		expect(select(feed, opened, true)).toEqual([]);
	});

	it('the baseline is the newest event of the room when the preview opens', () => {
		expect(
			latestActivityInRoom(
				[
					event('a', '2026-10-22T09:00:00Z'),
					event('b', '2026-10-22T09:30:00Z'),
					event('c', '2026-10-22T11:00:00Z', {
						params: { roomRef: '!r2:x' }
					})
				],
				ROOM
			)
		).toBe('2026-10-22T09:30:00Z');
		// An empty room starts the clock at the epoch: anything new counts.
		expect(latestActivityInRoom([], ROOM)).toBe(new Date(0).toISOString());
	});

	it('while a thread is shown, only events of that thread count', () => {
		const inThread = event('t', '2026-10-22T10:01:00Z', {
			eventType: 'thread.reply.new',
			actionPath: '/sessions/user/view/!r1:x/13?channel=thread:$root'
		});
		const mainRoom = event('m', '2026-10-22T10:01:00Z');
		expect(
			selectActivityEventsSeenWhileReading({
				feed: [inThread, mainRoom],
				visibleRoomId: ROOM,
				threadRootId: '$root',
				since: opened,
				unreadOnly: false
			})
		).toEqual(['t']);
	});
});
