import { afterEach, describe, expect, it } from 'vite-plus/test';
import { createClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { buildRoomTimeline } from './roomTimeline';

// FE#1802: an own message shows "sent" until a counterpart's read receipt
// covers it, then "read". Real matrix-js-sdk Room, so ordering, receipts and
// "the reader replied afterwards" follow the SDK rather than a mock.

const roomId = '!readstatus:example.org';
const me = '@counsellor:example.org';
const asker = '@asker:example.org';
const colleague = '@colleague:example.org';

const client = createClient({
	baseUrl: 'https://matrix.example.org',
	userId: me,
	accessToken: 'synthetic-read-status-token',
	fetchFn: async () => {
		throw new Error('No HTTP expected');
	}
});
afterEach(() => client.stopClient());

const message = (id: string, sender: string, ts: number) =>
	new MatrixEvent({
		event_id: id,
		room_id: roomId,
		sender,
		type: 'm.room.message',
		origin_server_ts: ts,
		content: { msgtype: 'm.text', body: id }
	});

const join = (userId: string) =>
	new MatrixEvent({
		event_id: `$join-${userId}`,
		room_id: roomId,
		sender: userId,
		state_key: userId,
		type: 'm.room.member',
		origin_server_ts: 1,
		content: { membership: 'join' }
	});

const readReceipt = (eventId: string, userId: string) =>
	new MatrixEvent({
		type: 'm.receipt',
		room_id: roomId,
		content: { [eventId]: { 'm.read': { [userId]: { ts: 9999 } } } }
	});

const roomWith = async (members: string[], events: MatrixEvent[]) => {
	const room = new Room(roomId, client, me);
	await room.addLiveEvents([...members.map(join), ...events], {
		addToState: true
	});
	return room;
};

const statusOf = (room: Room, readers?: string[]) =>
	Object.fromEntries(
		buildRoomTimeline(
			room.getLiveTimeline().getEvents(),
			roomId,
			room,
			'encrypted',
			readers
		).map((item: any) => [item._id, item.isNotRead])
	);

describe('own message read status from Matrix receipts', () => {
	it('stays unread while the peer read marker is before it, read at or after it', async () => {
		const room = await roomWith(
			[me, asker],
			[
				message('$first', me, 10),
				message('$second', me, 20),
				message('$third', me, 30)
			]
		);
		room.addReceipt(readReceipt('$second', asker));

		expect(statusOf(room)).toEqual({
			$first: false,
			$second: false,
			$third: true
		});
	});

	it('counts a peer reply as having read everything before it', async () => {
		const room = await roomWith(
			[me, asker],
			[message('$mine', me, 10), message('$reply', asker, 20)]
		);

		expect(statusOf(room)).toEqual({ $mine: false, $reply: undefined });
	});

	it('leaves incoming messages without a read status', async () => {
		const room = await roomWith(
			[me, asker],
			[message('$theirs', asker, 10)]
		);

		expect(statusOf(room)).toEqual({ $theirs: undefined });
	});

	it('ignores a silent colleague when the readers are named (1:1, ADR-002)', async () => {
		const room = await roomWith(
			[me, asker, colleague],
			[message('$mine', me, 10)]
		);
		room.addReceipt(readReceipt('$mine', colleague));

		expect(statusOf(room, [asker])).toEqual({ $mine: true });

		room.addReceipt(readReceipt('$mine', asker));
		expect(statusOf(room, [asker])).toEqual({ $mine: false });
	});

	it('marks a group message read once at least one other member read it', async () => {
		const room = await roomWith(
			[me, asker, colleague],
			[message('$mine', me, 10)]
		);
		expect(statusOf(room)).toEqual({ $mine: true });

		room.addReceipt(readReceipt('$mine', colleague));
		expect(statusOf(room)).toEqual({ $mine: false });
	});

	it('does not count my own receipt from another device', async () => {
		const room = await roomWith([me, asker], [message('$mine', me, 10)]);
		room.addReceipt(readReceipt('$mine', me));

		expect(statusOf(room)).toEqual({ $mine: true });
	});
});
