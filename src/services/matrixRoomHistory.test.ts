import { afterEach, expect, it } from 'vite-plus/test';
import { createClient, Direction, MatrixEvent, Room } from 'matrix-js-sdk';
import { loadEarlierMatrixRoomHistory } from './matrixRoomHistory';

const roomId = '!history:example.org';
const userId = '@reader:example.org';
const event = (id: string, body: string, timestamp: number) => ({
	event_id: id,
	room_id: roomId,
	sender: userId,
	type: 'm.room.message',
	origin_server_ts: timestamp,
	content: { msgtype: 'm.text', body }
});
const client = createClient({
	baseUrl: 'https://matrix.example.org',
	userId,
	accessToken: 'synthetic-history-token',
	fetchFn: async (url) => {
		const request = new URL(String(url));
		if (
			!request.pathname.endsWith('/messages') ||
			request.searchParams.get('from') !== 'earlier-page' ||
			request.searchParams.get('dir') !== 'b' ||
			request.searchParams.get('limit') !== '50'
		)
			throw new Error('Unexpected Matrix history HTTP request');
		return Response.json({
			start: 'earlier-page',
			end: 'start-of-room',
			chunk: [
				event('$overlap', 'Already visible', 3000),
				event('$earlier', 'Earlier counselling message', 2000),
				event('$opening', 'Original opening message', 1000)
			]
		});
	}
});
afterEach(() => client.stopClient());

it('loads the earlier Matrix page and returns chronological history without duplicates', async () => {
	const room = new Room(roomId, client, userId);
	client.store.storeRoom(room);
	await room.addLiveEvents(
		[
			new MatrixEvent(event('$overlap', 'Already visible', 3000)),
			new MatrixEvent(event('$latest', 'Latest reply', 4000))
		],
		{ addToState: true }
	);
	room.getLiveTimeline().setPaginationToken(
		'earlier-page',
		Direction.Backward
	);

	const messages = await loadEarlierMatrixRoomHistory(client, roomId, 50);
	expect(messages.map((message) => message.getContent().body)).toEqual([
		'Original opening message',
		'Earlier counselling message',
		'Already visible',
		'Latest reply'
	]);
});
