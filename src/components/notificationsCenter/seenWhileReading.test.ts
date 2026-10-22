import { describe, expect, it } from 'vitest';
import { selectActivityEventsSeenWhileReading } from './seenWhileReading';

const event = (id: string, room: string, extra: Record<string, unknown> = {}) =>
	({ id, roomRef: room, readAt: null, ...extra }) as any;
const roomOf = (item: any) => item.roomRef;
const isMessage = (item: any) => item.kind !== 'system';

const select = (
	feed: any[],
	room: string | null,
	known: string[] = [],
	unreadOnly = false
) =>
	selectActivityEventsSeenWhileReading({
		feed,
		visibleRoomId: room,
		knownIds: new Set(known),
		resolveRoomId: roomOf,
		isMessageEvent: isMessage,
		unreadOnly
	});

describe('selectActivityEventsSeenWhileReading (#1824 D1)', () => {
	it('selects only NEW unread message events of the visible room', () => {
		const feed = [
			event('old', '!r1'),
			event('a', '!r1'),
			event('b', '!r2'),
			event('c', '!r1', { readAt: '2026-10-21T10:00:00Z' }),
			event('d', '!r1', { kind: 'system' })
		];
		expect(select(feed, '!r1', ['old'])).toEqual(['a']);
	});

	it('does not touch events that were already there when the preview opened', () => {
		expect(select([event('old', '!r1')], '!r1', ['old'])).toEqual([]);
	});

	it('selects nothing without a visible room', () => {
		expect(select([event('a', '!r1')], null)).toEqual([]);
	});

	it('selects nothing while "unread only" is on (#845 cascade)', () => {
		expect(select([event('a', '!r1')], '!r1', [], true)).toEqual([]);
	});
});
