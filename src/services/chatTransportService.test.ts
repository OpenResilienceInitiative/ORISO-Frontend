// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatTransportService } from './chatTransportService';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

// Hoisted above the imports by vitest: endpoints/runtimeConfig read these
// REACT_APP_* vars at module load.
vi.hoisted(() => {
	const env = process.env as Record<string, string>;
	env.REACT_APP_API_URL = 'http://localhost:9001';
	env.REACT_APP_KEYCLOAK_REALM = 'oriso';
});

// The metadata-only notification is a network side effect; stub it so the
// transport tests stay deterministic and offline. We assert it never leaks
// message content (FE-H01) by inspecting the call args.
const apiPostMessageEventNotification = vi.fn(
	(_input: unknown): Promise<unknown> => Promise.resolve({})
);
vi.mock('../api/apiPostMessageEventNotification', () => ({
	apiPostMessageEventNotification: (input: unknown) =>
		apiPostMessageEventNotification(input)
}));

const apiGetSessionRoomBySessionId = vi.fn();
vi.mock('../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: (sessionId: number) =>
		apiGetSessionRoomBySessionId(sessionId)
}));

const ROOM_ID = '!room:matrix.oriso.org';
const OTHER_ROOM_ID = '!other:matrix.oriso.org';

type Listener = (...args: any[]) => void;

/**
 * Minimal Matrix client double: enough of the EventEmitter surface for
 * onMatrixRoomLifecycle / onMatrixRoomMembers plus getRoom for member loading.
 */
const createFakeMatrixClient = (room: any = null) => {
	const listeners = new Map<string, Set<Listener>>();
	return {
		on: (event: string, listener: Listener) => {
			if (!listeners.has(event)) {
				listeners.set(event, new Set());
			}
			listeners.get(event).add(listener);
		},
		off: (event: string, listener: Listener) => {
			listeners.get(event)?.delete(listener);
		},
		emit: (event: string, ...args: any[]) => {
			listeners.get(event)?.forEach((listener) => listener(...args));
		},
		listenerCount: (event: string) => listeners.get(event)?.size || 0,
		getRoom: (roomId: string) => (room && roomId === ROOM_ID ? room : null)
	};
};

const createFakeEncryptedMatrixEvent = () => {
	const decryptionListeners = new Set<Listener>();
	let eventType = 'm.room.encrypted';
	const event = {
		getType: () => eventType,
		on: (name: string, listener: Listener) => {
			if (name === 'Event.decrypted') decryptionListeners.add(listener);
		},
		off: (name: string, listener: Listener) => {
			if (name === 'Event.decrypted')
				decryptionListeners.delete(listener);
		},
		emitDecrypted: (error?: Error) => {
			if (!error) eventType = 'm.room.message';
			decryptionListeners.forEach((listener) => listener(event, error));
		}
	};
	return { decryptionListeners, event };
};

describe('chatTransportService Matrix timeline', () => {
	let fakeClient: ReturnType<typeof createFakeMatrixClient>;

	beforeEach(() => {
		fakeClient = createFakeMatrixClient();
		setMatrixClientServiceRef({
			getClient: () => fakeClient
		} as any);
	});

	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('notifies again when a live encrypted event decrypts after first delivery', () => {
		const { decryptionListeners, event } = createFakeEncryptedMatrixEvent();
		const room = { roomId: ROOM_ID };
		const listener = vi.fn();
		const detach = chatTransportService.onMatrixTimeline(ROOM_ID, listener);

		fakeClient.emit('Room.timeline', event, room, false);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenLastCalledWith(event, room, false);

		event.emitDecrypted(new Error('room key not available yet'));
		expect(listener).toHaveBeenCalledTimes(1);

		event.emitDecrypted();
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenLastCalledWith(event, room, false);

		detach?.();
		expect(decryptionListeners.size).toBe(0);
	});

	it('does not register a decryption listener after synchronous detach', () => {
		const { decryptionListeners, event } = createFakeEncryptedMatrixEvent();
		const room = { roomId: ROOM_ID };
		let detach: (() => void) | null = null;
		const listener = vi.fn(() => detach?.());
		detach = chatTransportService.onMatrixTimeline(ROOM_ID, listener);

		fakeClient.emit('Room.timeline', event, room, false);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(decryptionListeners.size).toBe(0);

		event.emitDecrypted();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('removes a pending decryption listener on detach', () => {
		const { decryptionListeners, event } = createFakeEncryptedMatrixEvent();
		const room = { roomId: ROOM_ID };
		const listener = vi.fn();
		const detach = chatTransportService.onMatrixTimeline(ROOM_ID, listener);

		fakeClient.emit('Room.timeline', event, room, false);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(decryptionListeners.size).toBe(1);

		detach?.();
		expect(decryptionListeners.size).toBe(0);

		event.emitDecrypted();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('expires a pending decryption listener after five minutes', () => {
		vi.useFakeTimers();
		try {
			const { decryptionListeners, event } =
				createFakeEncryptedMatrixEvent();
			const room = { roomId: ROOM_ID };
			const listener = vi.fn();
			chatTransportService.onMatrixTimeline(ROOM_ID, listener);

			fakeClient.emit('Room.timeline', event, room, false);
			expect(decryptionListeners.size).toBe(1);

			vi.advanceTimersByTime(5 * 60 * 1000);
			expect(decryptionListeners.size).toBe(0);

			event.emitDecrypted();
			expect(listener).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('chatTransportService Matrix room lifecycle', () => {
	let fakeClient: ReturnType<typeof createFakeMatrixClient>;

	beforeEach(() => {
		fakeClient = createFakeMatrixClient();
		setMatrixClientServiceRef({
			getClient: () => fakeClient
		} as any);
	});

	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('returns null when the Matrix client is not initialized', () => {
		setMatrixClientServiceRef(null);
		expect(
			chatTransportService.onMatrixRoomLifecycle(ROOM_ID, () => {})
		).toBeNull();
	});

	it('notifies when own membership changes to leave for the watched room', () => {
		const listener = vi.fn();
		chatTransportService.onMatrixRoomLifecycle(ROOM_ID, listener);

		fakeClient.emit(
			'Room.myMembership',
			{ roomId: ROOM_ID },
			'leave',
			'join'
		);

		expect(listener).toHaveBeenCalledWith({
			type: 'myMembership',
			membership: 'leave',
			prevMembership: 'join'
		});
	});

	it('notifies when own membership changes to ban', () => {
		const listener = vi.fn();
		chatTransportService.onMatrixRoomLifecycle(ROOM_ID, listener);

		fakeClient.emit(
			'Room.myMembership',
			{ roomId: ROOM_ID },
			'ban',
			'join'
		);

		expect(listener).toHaveBeenCalledWith({
			type: 'myMembership',
			membership: 'ban',
			prevMembership: 'join'
		});
	});

	it('ignores own-membership changes of other rooms and non-terminal memberships', () => {
		const listener = vi.fn();
		chatTransportService.onMatrixRoomLifecycle(ROOM_ID, listener);

		fakeClient.emit(
			'Room.myMembership',
			{ roomId: OTHER_ROOM_ID },
			'leave',
			'join'
		);
		fakeClient.emit(
			'Room.myMembership',
			{ roomId: ROOM_ID },
			'join',
			'invite'
		);

		expect(listener).not.toHaveBeenCalled();
	});

	it('notifies on m.room.tombstone timeline events for the watched room', () => {
		const listener = vi.fn();
		chatTransportService.onMatrixRoomLifecycle(ROOM_ID, listener);

		fakeClient.emit(
			'Room.timeline',
			{ getType: () => 'm.room.tombstone' },
			{ roomId: ROOM_ID },
			false
		);

		expect(listener).toHaveBeenCalledWith({ type: 'tombstoned' });
	});

	it('ignores non-tombstone timeline events', () => {
		const listener = vi.fn();
		chatTransportService.onMatrixRoomLifecycle(ROOM_ID, listener);

		fakeClient.emit(
			'Room.timeline',
			{ getType: () => 'm.room.message' },
			{ roomId: ROOM_ID },
			false
		);

		expect(listener).not.toHaveBeenCalled();
	});

	it('detaches listeners on cleanup', () => {
		const listener = vi.fn();
		const detach = chatTransportService.onMatrixRoomLifecycle(
			ROOM_ID,
			listener
		);

		detach();
		fakeClient.emit(
			'Room.myMembership',
			{ roomId: ROOM_ID },
			'leave',
			'join'
		);

		expect(listener).not.toHaveBeenCalled();
		expect(fakeClient.listenerCount('Room.myMembership')).toBe(0);
		expect(fakeClient.listenerCount('Room.timeline')).toBe(0);
	});
});

describe('chatTransportService Matrix room members', () => {
	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('loads full membership from the homeserver before reading (lazyLoadMembers)', async () => {
		const loadMembersIfNeeded = vi.fn(() => Promise.resolve());
		const members = [{ userId: '@a:x' }, { userId: '@b:x' }];
		const room = {
			loadMembersIfNeeded,
			getMembers: () => members
		};
		setMatrixClientServiceRef({
			getClient: () => createFakeMatrixClient(room)
		} as any);

		const result =
			await chatTransportService.loadMatrixRoomMembers(ROOM_ID);

		expect(loadMembersIfNeeded).toHaveBeenCalled();
		expect(result).toEqual(members);
	});

	it('falls back to the cached member list when the lazy load fails', async () => {
		const members = [{ userId: '@a:x' }];
		const room = {
			loadMembersIfNeeded: () => Promise.reject(new Error('offline')),
			getMembers: () => members
		};
		setMatrixClientServiceRef({
			getClient: () => createFakeMatrixClient(room)
		} as any);

		await expect(
			chatTransportService.loadMatrixRoomMembers(ROOM_ID)
		).resolves.toEqual(members);
	});

	it('returns an empty list when the room is unknown', async () => {
		setMatrixClientServiceRef({
			getClient: () => createFakeMatrixClient(null)
		} as any);

		await expect(
			chatTransportService.loadMatrixRoomMembers(ROOM_ID)
		).resolves.toEqual([]);
	});

	it('notifies on RoomState.members and RoomMember.membership for the watched room only', () => {
		const fakeClient = createFakeMatrixClient();
		setMatrixClientServiceRef({
			getClient: () => fakeClient
		} as any);

		const listener = vi.fn();
		const detach = chatTransportService.onMatrixRoomMembers(
			ROOM_ID,
			listener
		);

		fakeClient.emit('RoomState.members', {}, { roomId: ROOM_ID }, {});
		fakeClient.emit('RoomMember.membership', {}, { roomId: ROOM_ID });
		expect(listener).toHaveBeenCalledTimes(2);

		fakeClient.emit('RoomState.members', {}, { roomId: OTHER_ROOM_ID }, {});
		fakeClient.emit('RoomMember.membership', {}, { roomId: OTHER_ROOM_ID });
		expect(listener).toHaveBeenCalledTimes(2);

		detach();
		fakeClient.emit('RoomState.members', {}, { roomId: ROOM_ID }, {});
		expect(listener).toHaveBeenCalledTimes(2);
	});
});

describe('chatTransportService sendTextMessage (Matrix-only transport)', () => {
	beforeEach(() => {
		apiPostMessageEventNotification.mockClear();
	});

	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('rejects (no silent success, no RC path) when the session has no Matrix room', async () => {
		const sendMessage = vi.fn();
		const override = {
			getClient: () => createFakeMatrixClient(),
			sendMessage
		} as any;

		await expect(
			chatTransportService.sendTextMessage({
				roomIdOrSessionId: 42,
				message: 'hello',
				sendMailNotification: false,
				isEncrypted: false,
				matrixRoomId: undefined,
				matrixClientServiceOverride: override
			})
		).rejects.toThrow('Cannot send message: session has no Matrix room');

		// The removed Rocket.Chat fallback must not be reached: no send, no
		// metadata notification.
		expect(sendMessage).not.toHaveBeenCalled();
		expect(apiPostMessageEventNotification).not.toHaveBeenCalled();
	});

	it('rejects when a Matrix room exists but the client is not initialized', async () => {
		const override = {
			getClient: () => null,
			sendMessage: vi.fn()
		} as any;

		await expect(
			chatTransportService.sendTextMessage({
				roomIdOrSessionId: ROOM_ID,
				message: 'hello',
				sendMailNotification: false,
				isEncrypted: false,
				matrixRoomId: ROOM_ID,
				matrixClientServiceOverride: override
			})
		).rejects.toThrow('Matrix client not initialized');
	});

	it('refreshes a stale pre-accept session to resolve its Matrix room before sending', async () => {
		apiGetSessionRoomBySessionId.mockResolvedValueOnce({
			sessions: [{ session: { id: 42, matrixRoomId: ROOM_ID } }]
		});
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$evt:matrix.oriso.org' })
		);
		const override = {
			getClient: () => createFakeMatrixClient(),
			sendMessage
		} as any;

		await chatTransportService.sendTextMessage({
			roomIdOrSessionId: 42,
			message: 'hello after accept',
			sendMailNotification: false,
			isEncrypted: false,
			sessionId: 42,
			matrixRoomId: undefined,
			matrixClientServiceOverride: override
		});

		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledWith(42);
		expect(sendMessage).toHaveBeenCalledWith(
			ROOM_ID,
			'hello after accept',
			{
				replyToEventId: null,
				threadRootId: null
			}
		);
	});

	it('rejects when refreshing a stale session still returns no Matrix room', async () => {
		apiGetSessionRoomBySessionId.mockResolvedValueOnce({ sessions: [] });

		await expect(
			chatTransportService.sendTextMessage({
				roomIdOrSessionId: 42,
				message: 'hello',
				sendMailNotification: false,
				isEncrypted: false,
				sessionId: 42,
				matrixRoomId: undefined,
				matrixClientServiceOverride: {
					getClient: () => createFakeMatrixClient(),
					sendMessage: vi.fn()
				} as any
			})
		).rejects.toThrow('Cannot send message: session has no Matrix room');
	});

	it('sends via the Matrix client with the room id and message when a room id is present', async () => {
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$evt:matrix.oriso.org' })
		);
		const override = {
			getClient: () => createFakeMatrixClient(),
			sendMessage
		} as any;

		const result = await chatTransportService.sendTextMessage({
			roomIdOrSessionId: ROOM_ID,
			message: 'hello world',
			sendMailNotification: false,
			isEncrypted: false,
			matrixRoomId: ROOM_ID,
			matrixClientServiceOverride: override
		});

		expect(sendMessage).toHaveBeenCalledWith(ROOM_ID, 'hello world', {
			replyToEventId: null,
			threadRootId: null
		});
		expect(result).toEqual({
			success: true,
			event_id: '$evt:matrix.oriso.org'
		});

		// A metadata-only notification fires, and it never carries the
		// plaintext message body across the Matrix privacy boundary (FE-H01).
		expect(apiPostMessageEventNotification).toHaveBeenCalledTimes(1);
		const notificationArg =
			apiPostMessageEventNotification.mock.calls[0][0];
		expect(notificationArg).toMatchObject({
			roomId: ROOM_ID,
			matrixRoom: true
		});
		expect(JSON.stringify(notificationArg)).not.toContain('hello world');
	});
});

describe('chatTransportService markRoomAsRead', () => {
	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	const setClientWithRoom = (room: any) => {
		setMatrixClientServiceRef({
			getClient: () => ({
				getRoom: (roomId: string) =>
					room && roomId === ROOM_ID ? room : null,
				sendReadReceipt: room?.sendReadReceipt
			})
		} as any);
	};

	it('sends a read receipt for the latest live-timeline event', async () => {
		const latestEvent = { id: 'latest' };
		const sendReadReceipt = vi.fn(() => Promise.resolve());
		const room = {
			getLiveTimeline: () => ({
				getEvents: () => [{ id: 'older' }, latestEvent]
			}),
			sendReadReceipt
		};
		setClientWithRoom(room);

		await chatTransportService.markRoomAsRead(ROOM_ID);

		expect(sendReadReceipt).toHaveBeenCalledTimes(1);
		expect(sendReadReceipt).toHaveBeenCalledWith(latestEvent);
	});

	it('is a safe no-op (no throw) when the Matrix client is missing', async () => {
		setMatrixClientServiceRef(null);
		await expect(
			chatTransportService.markRoomAsRead(ROOM_ID)
		).resolves.toBeUndefined();
	});

	it('is a safe no-op when the room is unknown', async () => {
		setClientWithRoom(null);
		await expect(
			chatTransportService.markRoomAsRead(ROOM_ID)
		).resolves.toBeUndefined();
	});

	it('is a safe no-op when the room has no events', async () => {
		const sendReadReceipt = vi.fn(() => Promise.resolve());
		const room = {
			getLiveTimeline: () => ({ getEvents: () => [] }),
			sendReadReceipt
		};
		setClientWithRoom(room);

		await expect(
			chatTransportService.markRoomAsRead(ROOM_ID)
		).resolves.toBeUndefined();
		expect(sendReadReceipt).not.toHaveBeenCalled();
	});

	it('swallows a failing read-receipt send (no throw)', async () => {
		const room = {
			getLiveTimeline: () => ({
				getEvents: () => [{ id: 'latest' }]
			}),
			sendReadReceipt: () => Promise.reject(new Error('offline'))
		};
		setClientWithRoom(room);

		await expect(
			chatTransportService.markRoomAsRead(ROOM_ID)
		).resolves.toBeUndefined();
	});
});

describe('chatTransportService reply relation (#435)', () => {
	beforeEach(() => {
		apiPostMessageEventNotification.mockClear();
	});

	const makeServiceFake = () => {
		const sendMessage = vi.fn(async () => ({ event_id: '$new:hs' }));
		return {
			fake: {
				getClient: () => ({}) as any,
				sendMessage
			} as any,
			sendMessage
		};
	};

	it('passes replyToEventId through to the Matrix send as an option', async () => {
		const { fake, sendMessage } = makeServiceFake();
		const result = await chatTransportService.sendTextMessage({
			roomIdOrSessionId: ROOM_ID,
			message: 'antwort',
			sendMailNotification: false,
			isEncrypted: true,
			matrixRoomId: ROOM_ID,
			replyToEventId: '$orig:hs',
			matrixClientServiceOverride: fake
		});
		expect(sendMessage).toHaveBeenCalledWith(ROOM_ID, 'antwort', {
			replyToEventId: '$orig:hs',
			threadRootId: null
		});
		expect(result).toEqual({ success: true, event_id: '$new:hs' });
	});

	it('sends without reply options when not replying', async () => {
		const { fake, sendMessage } = makeServiceFake();
		await chatTransportService.sendTextMessage({
			roomIdOrSessionId: ROOM_ID,
			message: 'normal',
			sendMailNotification: false,
			isEncrypted: true,
			matrixRoomId: ROOM_ID,
			matrixClientServiceOverride: fake
		});
		expect(sendMessage).toHaveBeenCalledWith(ROOM_ID, 'normal', {
			replyToEventId: null,
			threadRootId: null
		});
	});

	it('FE-H01: the metadata notification never carries reply content or ids beyond metadata', async () => {
		const { fake } = makeServiceFake();
		await chatTransportService.sendTextMessage({
			roomIdOrSessionId: ROOM_ID,
			message: 'geheime antwort',
			sendMailNotification: false,
			isEncrypted: true,
			matrixRoomId: ROOM_ID,
			replyToEventId: '$orig:hs',
			matrixClientServiceOverride: fake
		});
		expect(apiPostMessageEventNotification).toHaveBeenCalledTimes(1);
		const payload = apiPostMessageEventNotification.mock
			.calls[0][0] as Record<string, unknown>;
		const serialized = JSON.stringify(payload);
		expect(serialized).not.toContain('geheime antwort');
		expect(serialized).not.toContain('$orig:hs');
	});
});
