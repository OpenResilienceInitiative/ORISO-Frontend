import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createClient, KnownMembership, MatrixClient } from 'matrix-js-sdk';
import {
	MatrixRoomNotSyncedError,
	installSendRoomGuard,
	waitForJoinedRoom
} from './matrixSendRoomGuard';

const ROOM_ID = '!livechat:matrix.example.org';

/**
 * A real matrix-js-sdk client against a fake homeserver that records every
 * PUT /send/<type>/<txn>. Nothing syncs, so the client's store never holds the
 * room — exactly the state of a client generation that a token refresh or a
 * stale-device recovery has just created.
 */
const createRecordingClient = () => {
	const sentEventTypes: string[] = [];
	const client = createClient({
		baseUrl: 'https://matrix.example.org',
		accessToken: 'token',
		userId: '@consultant:matrix.example.org',
		deviceId: 'FRESH_DEVICE',
		fetchFn: async (input) => {
			const url = String(input);
			const send = /\/rooms\/[^/]+\/send\/([^/]+)\//.exec(url);
			if (send) {
				sentEventTypes.push(decodeURIComponent(send[1]));
				return new Response(JSON.stringify({ event_id: '$sent' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
			return new Response('{}', {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}
	});
	return { client, sentEventTypes };
};

const joinedRoom = (membership: string = KnownMembership.Join) => ({
	roomId: ROOM_ID,
	getMyMembership: () => membership
});

describe('matrixSendRoomGuard', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('documents the SDK hazard: an unguarded send into a room the client has not synced goes out as plaintext m.room.message', async () => {
		const { client, sentEventTypes } = createRecordingClient();

		await client.sendMessage(ROOM_ID, {
			msgtype: 'm.text',
			body: 'synthetic counselling text'
		});

		// matrix-js-sdk encryptEventIfNeeded(): "If the room is unknown, we
		// cannot encrypt for it" — so it PUTs the clear event. This is the P0
		// leak seen on Dev (Live Chat sessions 110–115).
		expect(sentEventTypes).toEqual(['m.room.message']);
	});

	it('refuses to send into a room the client has not synced and sends nothing', async () => {
		const { client, sentEventTypes } = createRecordingClient();
		installSendRoomGuard(client, { waitMs: 50, pollIntervalMs: 10 });

		await expect(
			client.sendMessage(ROOM_ID, {
				msgtype: 'm.text',
				body: 'synthetic counselling text'
			})
		).rejects.toBeInstanceOf(MatrixRoomNotSyncedError);
		expect(sentEventTypes).toEqual([]);
	});

	it('refuses the thread overload of sendEvent as well', async () => {
		const { client, sentEventTypes } = createRecordingClient();
		installSendRoomGuard(client, { waitMs: 50, pollIntervalMs: 10 });

		await expect(
			client.sendEvent(ROOM_ID, null, 'm.room.message' as any, {
				msgtype: 'm.text',
				body: 'synthetic counselling text'
			})
		).rejects.toBeInstanceOf(MatrixRoomNotSyncedError);
		expect(sentEventTypes).toEqual([]);
	});

	it('waits for sync to deliver the joined room, then hands the send to the SDK', async () => {
		vi.useFakeTimers();
		let room: ReturnType<typeof joinedRoom> | null = null;
		const originalSendEvent = vi.fn().mockResolvedValue({
			event_id: '$sent'
		});
		const client = {
			getRoom: vi.fn(() => room),
			sendEvent: originalSendEvent
		} as unknown as MatrixClient;
		installSendRoomGuard(client, { waitMs: 5_000, pollIntervalMs: 100 });

		const send = client.sendEvent(
			ROOM_ID,
			'm.room.message' as any,
			{
				msgtype: 'm.text',
				body: 'hello'
			} as any
		);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(originalSendEvent).not.toHaveBeenCalled();

		room = joinedRoom();
		await vi.advanceTimersByTimeAsync(100);

		await expect(send).resolves.toEqual({ event_id: '$sent' });
		expect(originalSendEvent).toHaveBeenCalledWith(
			ROOM_ID,
			'm.room.message',
			{ msgtype: 'm.text', body: 'hello' }
		);
	});

	it('does not treat an invite (stripped state) as a synced room', async () => {
		const originalSendEvent = vi.fn();
		const client = {
			getRoom: () => joinedRoom(KnownMembership.Invite),
			sendEvent: originalSendEvent
		} as unknown as MatrixClient;
		installSendRoomGuard(client, { waitMs: 30, pollIntervalMs: 10 });

		await expect(
			client.sendEvent(ROOM_ID, 'm.room.message' as any, {} as any)
		).rejects.toBeInstanceOf(MatrixRoomNotSyncedError);
		expect(originalSendEvent).not.toHaveBeenCalled();
	});

	it('lets reactions through untouched (the SDK never encrypts m.reaction)', async () => {
		const originalSendEvent = vi.fn().mockResolvedValue({
			event_id: '$reaction'
		});
		const client = {
			getRoom: () => null,
			sendEvent: originalSendEvent
		} as unknown as MatrixClient;
		installSendRoomGuard(client, { waitMs: 30, pollIntervalMs: 10 });

		await expect(
			client.sendEvent(ROOM_ID, 'm.reaction' as any, {} as any)
		).resolves.toEqual({ event_id: '$reaction' });
	});

	it('waitForJoinedRoom resolves with the synced room', async () => {
		const room = joinedRoom();
		const client = {
			getRoom: () => room
		} as unknown as MatrixClient;

		await expect(waitForJoinedRoom(client, ROOM_ID)).resolves.toBe(room);
	});
});
