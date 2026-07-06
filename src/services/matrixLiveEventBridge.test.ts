// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
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
				endCall: (...callArgs: unknown[]) => endCall(...callArgs)
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
	return {
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
};

const makeEvent = (overrides: Record<string, any> = {}) => {
	const {
		type = 'm.room.message',
		content = {},
		sender = OTHER_USER_ID,
		ts = Date.now(),
		id = '$evt:matrix.oriso.org'
	} = overrides;
	return {
		getType: () => type,
		getContent: () => content,
		getSender: () => sender,
		getTs: () => ts,
		getId: () => id
	};
};

const room = { roomId: ROOM_ID };

describe('MatrixLiveEventBridge initialize / timeline binding', () => {
	let bridge: MatrixLiveEventBridge;
	let client: ReturnType<typeof createFakeMatrixClient>;

	beforeEach(() => {
		receiveCall.mockClear();
		endCall.mockClear();
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
		expect(endCall).not.toHaveBeenCalled();

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
		expect(endCall).toHaveBeenCalledTimes(1);
		expect(endCall).toHaveBeenCalledWith(false);
	});
});
