// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { MatrixLiveEventBridge } from './matrixLiveEventBridge';

// Hoisted above the imports by vitest: endpoints/runtimeConfig read these
// REACT_APP_* vars at module load (transitively via CallManager).
vi.hoisted(() => {
	const env = process.env as Record<string, string>;
	env.REACT_APP_API_URL = 'http://localhost:9001';
	env.REACT_APP_KEYCLOAK_REALM = 'oriso';
});

// The bridge lazy-requires CallManager and videoCallHelpers inside its
// handlers (to dodge a circular import with matrixClientService). Those real
// modules pull in a heavy transitive graph (matrix-js-sdk webrtc, lottie,
// endpoints). Because the bridge uses CommonJS require() (not a static ESM
// import), vitest's vi.mock does not intercept it. Instead we intercept the
// underlying Node module loader for exactly these two specifiers and return
// lightweight stubs — keeping the test deterministic and free of the heavy
// call/video subsystem. The bridge only require()s these lazily inside its
// handlers (never at import time), so patching here — after the imports — is
// still in place before any test triggers a handler.
const receiveCall = vi.fn();
const endCall = vi.fn();
const endCallIfMatching = vi.fn();
const isVideoCallFromMatrixInviteContent = vi.fn(
	(_content: unknown): boolean => false
);

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire('module') as {
	_load: (...args: unknown[]) => unknown;
};
const originalLoad = Module._load;
Module._load = function patchedLoad(this: unknown, ...args: unknown[]) {
	const request = args[0];
	if (request === './CallManager') {
		return {
			callManager: {
				receiveCall: (...callArgs: unknown[]) =>
					receiveCall(...callArgs),
				endCall: (...callArgs: unknown[]) => endCall(...callArgs),
				endCallIfMatching: (...callArgs: unknown[]) =>
					endCallIfMatching(...callArgs)
			}
		};
	}
	if (request === '../utils/videoCallHelpers') {
		return {
			isVideoCallFromMatrixInviteContent: (content: unknown) =>
				isVideoCallFromMatrixInviteContent(content)
		};
	}
	return originalLoad.apply(this, args);
};

const ROOM_ID = '!room:matrix.oriso.org';
const MY_USER_ID = '@me:matrix.oriso.org';
const OTHER_USER_ID = '@peer:matrix.oriso.org';

type Listener = (...args: any[]) => void;

/**
 * Minimal Matrix client double: enough EventEmitter surface for the bridge
 * (on / removeAllListeners) plus getUserId and a manual emit helper.
 */
const createFakeMatrixClient = (userId = MY_USER_ID) => {
	const listeners = new Map<string, Set<Listener>>();
	const event = {
		on: (event: string, listener: Listener) => {
			if (!listeners.has(event)) {
				listeners.set(event, new Set());
			}
			listeners.get(event)!.add(listener);
		},
		removeAllListeners: (event: string) => {
			listeners.delete(event);
		},
		getUserId: () => userId,
		listenerCount: (event: string) => listeners.get(event)?.size || 0,
		emit: (event: string, ...args: any[]) => {
			listeners.get(event)?.forEach((listener) => listener(...args));
		}
	};
	return event;
};

const makeEvent = (overrides: Record<string, any> = {}) => {
	const {
		type = 'm.room.message',
		content = {},
		sender = OTHER_USER_ID,
		ts = Date.now(),
		id = '$evt:matrix.oriso.org'
	} = overrides;
	let currentType = type;
	let currentContent = content;
	const listeners = new Map<string, Set<Listener>>();
	const event = {
		getType: () => currentType,
		getContent: () => currentContent,
		getSender: () => sender,
		getTs: () => ts,
		getId: () => id,
		on: (event: string, listener: Listener) => {
			if (!listeners.has(event)) listeners.set(event, new Set());
			listeners.get(event)!.add(listener);
		},
		off: (event: string, listener: Listener) => {
			listeners.get(event)?.delete(listener);
		},
		emitDecrypted: (
			clearEvent?: { type: string; content: Record<string, any> },
			error?: Error
		) => {
			if (clearEvent && !error) {
				currentType = clearEvent.type;
				currentContent = clearEvent.content;
			}
			listeners
				.get('Event.decrypted')
				?.forEach((listener) => listener(event, error));
		}
	};
	return event;
};

const room = { roomId: ROOM_ID };

describe('MatrixLiveEventBridge initialize / timeline binding', () => {
	let bridge: MatrixLiveEventBridge;
	let client: ReturnType<typeof createFakeMatrixClient>;

	beforeEach(() => {
		receiveCall.mockClear();
		endCall.mockClear();
		endCallIfMatching.mockClear();
		isVideoCallFromMatrixInviteContent.mockClear();
		isVideoCallFromMatrixInviteContent.mockReturnValue(false);
		bridge = new MatrixLiveEventBridge();
		client = createFakeMatrixClient();
	});

	afterEach(() => {
		bridge.destroy();
	});

	it('attaches a Room.timeline listener on initialize and marks itself initialized', () => {
		expect(bridge.isInitialized()).toBe(false);

		bridge.initialize(client as any);

		expect(bridge.isInitialized()).toBe(true);
		expect(bridge.getClient()).toBe(client);
		expect(client.listenerCount('Room.timeline')).toBe(1);
	});

	it('ignores historical events (toStartOfTimeline === true)', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on('directMessage', callback);

		// Historical playback (scroll-back / initial sync backfill).
		client.emit('Room.timeline', makeEvent(), room, true);

		expect(callback).not.toHaveBeenCalled();
	});

	it('forwards metadata-only directMessage for live m.room.message events', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on('directMessage', callback);

		client.emit(
			'Room.timeline',
			makeEvent({ content: { msgtype: 'm.text', body: 'secret body' } }),
			room,
			false
		);

		expect(callback).toHaveBeenCalledTimes(1);
		const payload = callback.mock.calls[0][0];
		expect(payload).toMatchObject({
			roomId: ROOM_ID,
			sender: OTHER_USER_ID,
			isOwnMessage: false,
			msgtype: 'm.text'
		});
		// Bodies never cross into the bridged event (Matrix privacy boundary).
		expect(JSON.stringify(payload)).not.toContain('secret body');
	});

	it('refreshes metadata only once when an encrypted message decrypts later', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on('directMessage', callback);
		const event = makeEvent({ type: 'm.room.encrypted' });

		client.emit('Room.timeline', event, room, false);
		event.emitDecrypted({
			type: 'm.room.message',
			content: { msgtype: 'm.text', body: 'secret body' }
		});

		expect(callback).toHaveBeenCalledTimes(1);
	});
});

describe('MatrixLiveEventBridge call-invite de-dupe & stale handling', () => {
	let bridge: MatrixLiveEventBridge;
	let client: ReturnType<typeof createFakeMatrixClient>;

	const emitInvite = (overrides: Record<string, any> = {}) =>
		client.emit(
			'Room.timeline',
			makeEvent({ type: 'm.call.invite', ...overrides }),
			room,
			false
		);

	beforeEach(() => {
		receiveCall.mockClear();
		endCall.mockClear();
		endCallIfMatching.mockClear();
		isVideoCallFromMatrixInviteContent.mockClear();
		isVideoCallFromMatrixInviteContent.mockReturnValue(false);
		bridge = new MatrixLiveEventBridge();
		client = createFakeMatrixClient();
		bridge.initialize(client as any);
	});

	afterEach(() => {
		bridge.destroy();
	});

	it('ignores stale call invites older than 10s (history/replay on login)', () => {
		emitInvite({
			content: { call_id: 'call-stale' },
			ts: Date.now() - 60_000
		});

		expect(receiveCall).not.toHaveBeenCalled();
	});

	it('recovers an old Element Call invite when the call room still has active MatrixRTC membership', () => {
		const callRoomId = '!active-call:matrix.oriso.org';
		const activeCallRoom = { roomId: callRoomId };
		(client as any).getRoom = vi.fn((roomId: string) =>
			roomId === callRoomId ? activeCallRoom : null
		);
		const membershipSpy = vi
			.spyOn(MatrixRTCSession, 'sessionMembershipsForRoom')
			.mockReturnValue([{} as any]);

		emitInvite({
			content: {
				call_id: 'call-active-after-reload',
				is_element_call: true,
				is_group_call: false,
				is_video: false,
				call_room_id: callRoomId
			},
			ts: Date.now() - 60_000
		});

		expect(receiveCall).toHaveBeenCalledWith(
			callRoomId,
			false,
			'call-active-after-reload',
			OTHER_USER_ID,
			false,
			ROOM_ID,
			true
		);
		membershipSpy.mockRestore();
	});

	it('scans the synced timeline after reload for an active Element Call invite', () => {
		const callRoomId = '!active-call:matrix.oriso.org';
		const historicalInvite = makeEvent({
			type: 'org.oriso.call.invite',
			content: {
				call_id: 'call-active-in-sync',
				is_element_call: true,
				is_group_call: false,
				is_video: false,
				call_room_id: callRoomId
			},
			ts: Date.now() - 60_000
		});
		const syncedSignalRoom = {
			roomId: ROOM_ID,
			getLiveTimeline: () => ({ getEvents: () => [historicalInvite] })
		};
		const activeCallRoom = { roomId: callRoomId };
		(client as any).getRooms = vi.fn(() => [syncedSignalRoom]);
		(client as any).getRoom = vi.fn((roomId: string) =>
			roomId === callRoomId ? activeCallRoom : null
		);
		const membershipSpy = vi
			.spyOn(MatrixRTCSession, 'sessionMembershipsForRoom')
			.mockReturnValue([{} as any]);

		client.emit('sync', 'PREPARED', null);

		expect(receiveCall).toHaveBeenCalledWith(
			callRoomId,
			false,
			'call-active-in-sync',
			OTHER_USER_ID,
			false,
			ROOM_ID,
			true
		);
		membershipSpy.mockRestore();
	});

	it('stops active-call recovery after two sync scans without a candidate', () => {
		const getRooms = vi.fn(() => []);
		(client as any).getRooms = getRooms;

		client.emit('sync', 'PREPARED', null);
		client.emit('sync', 'SYNCING', 'PREPARED');
		client.emit('sync', 'SYNCING', 'SYNCING');

		expect(getRooms).toHaveBeenCalledTimes(2);
		expect(receiveCall).not.toHaveBeenCalled();
	});

	it('recovers an older active invite when the newest candidate was already processed', () => {
		const newestCallRoomId = '!newest-call:matrix.oriso.org';
		const olderCallRoomId = '!older-call:matrix.oriso.org';
		emitInvite({
			content: {
				call_id: 'already-processed',
				is_element_call: true,
				call_room_id: newestCallRoomId
			},
			ts: Date.now()
		});
		receiveCall.mockClear();

		const newestInvite = makeEvent({
			type: 'org.oriso.call.invite',
			content: {
				call_id: 'already-processed',
				is_element_call: true,
				call_room_id: newestCallRoomId
			},
			ts: Date.now()
		});
		const olderInvite = makeEvent({
			type: 'org.oriso.call.invite',
			content: {
				call_id: 'recoverable-older',
				is_element_call: true,
				call_room_id: olderCallRoomId
			},
			ts: Date.now() - 60_000
		});
		(client as any).getRooms = vi.fn(() => [
			{
				roomId: ROOM_ID,
				getLiveTimeline: () => ({
					getEvents: () => [olderInvite, newestInvite]
				})
			}
		]);
		(client as any).getRoom = vi.fn((roomId: string) => ({ roomId }));
		const membershipSpy = vi
			.spyOn(MatrixRTCSession, 'sessionMembershipsForRoom')
			.mockReturnValue([{} as any]);

		client.emit('sync', 'PREPARED', null);

		expect(receiveCall).toHaveBeenCalledWith(
			olderCallRoomId,
			true,
			'recoverable-older',
			OTHER_USER_ID,
			false,
			ROOM_ID,
			true
		);
		membershipSpy.mockRestore();
	});

	it('ignores our own call invites', () => {
		emitInvite({
			content: { call_id: 'call-mine' },
			sender: MY_USER_ID,
			ts: Date.now()
		});

		expect(receiveCall).not.toHaveBeenCalled();
	});

	it('receives a fresh incoming invite and de-dupes repeats of the same call_id', () => {
		emitInvite({
			content: { call_id: 'call-fresh' },
			ts: Date.now()
		});
		// A duplicate delivery of the same call must not re-trigger.
		emitInvite({
			content: { call_id: 'call-fresh' },
			ts: Date.now()
		});

		expect(receiveCall).toHaveBeenCalledTimes(1);
		// (roomId, isVideo, callId, sender, isGroupCall, notifyRoomId)
		const args = receiveCall.mock.calls[0];
		expect(args[0]).toBe(ROOM_ID);
		expect(args[2]).toBe('call-fresh');
		expect(args[3]).toBe(OTHER_USER_ID);
		expect(args[4]).toBe(false);
	});

	it('routes an Element/LiveKit group call invite through CallManager as a group call', () => {
		emitInvite({
			content: {
				call_id: 'call-group',
				is_group_call: true,
				is_video: true,
				call_room_id: '!element:matrix.oriso.org'
			},
			ts: Date.now()
		});

		expect(receiveCall).toHaveBeenCalledTimes(1);
		const args = receiveCall.mock.calls[0];
		expect(args[0]).toBe('!element:matrix.oriso.org'); // callRoomId
		expect(args[1]).toBe(true); // isVideo
		expect(args[2]).toBe('call-group'); // callId
		expect(args[4]).toBe(true); // isGroupCall
	});

	it('ignores an encrypted group-call invite that only decrypts after its freshness window', () => {
		const event = makeEvent({
			type: 'm.room.encrypted',
			ts: Date.now() - 11_000
		});

		client.emit('Room.timeline', event, room, false);
		expect(receiveCall).not.toHaveBeenCalled();

		// A missing room key can fail the first attempt. The bridge must remain
		// subscribed so the Rust-Crypto retry can deliver the clear event later.
		event.emitDecrypted(undefined, new Error('missing room key'));
		expect(receiveCall).not.toHaveBeenCalled();

		event.emitDecrypted({
			type: 'org.oriso.call.invite',
			content: {
				call_id: 'call-encrypted',
				is_group_call: true,
				is_element_call: true,
				is_video: true,
				call_room_id: '!element:matrix.oriso.org'
			}
		});

		expect(receiveCall).not.toHaveBeenCalled();

		// Further SDK notifications for the same MatrixEvent must not dispatch it
		// again after the bridge has consumed the successful decryption.
		event.emitDecrypted();
		expect(receiveCall).not.toHaveBeenCalled();
	});

	it('ignores stale hangups but ends the call for a fresh hangup', () => {
		client.emit(
			'Room.timeline',
			makeEvent({
				type: 'm.call.hangup',
				content: { call_id: 'c' },
				ts: Date.now() - 60_000
			}),
			room,
			false
		);
		expect(endCallIfMatching).not.toHaveBeenCalled();

		client.emit(
			'Room.timeline',
			makeEvent({
				type: 'm.call.hangup',
				content: { call_id: 'c' },
				ts: Date.now()
			}),
			room,
			false
		);
		expect(endCallIfMatching).toHaveBeenCalledTimes(1);
		expect(endCallIfMatching).toHaveBeenCalledWith('c');
		expect(endCall).not.toHaveBeenCalled();
	});
});
