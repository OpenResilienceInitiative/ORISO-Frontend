// @vitest-environment jsdom
/**
 * P2 feed-update signal: the bridge must recognise the content-free
 * `org.oriso.feed.updated` signal UserService sends through Matrix and surface
 * it as a dedicated bridge event, so NotificationsProvider can refresh the
 * Activity-Timeline feed immediately instead of waiting for the 15 s poll.
 *
 * The signal is transported as a Matrix **to-device** message (no room, no
 * persisted timeline entry, empty content). A room-timeline copy of the same
 * event type is accepted too, so a future room-based sender needs no frontend
 * change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import {
	FEED_UPDATE_BRIDGE_EVENT,
	FEED_UPDATE_EVENT_TYPE,
	MatrixLiveEventBridge
} from './matrixLiveEventBridge';

vi.hoisted(() => {
	const env = process.env as Record<string, string>;
	env.REACT_APP_API_URL = 'http://localhost:9001';
	env.REACT_APP_KEYCLOAK_REALM = 'oriso';
});

// Same lazy-require interception as matrixLiveEventBridge.test.ts: the bridge
// require()s CallManager / videoCallHelpers inside its handlers, which vi.mock
// cannot intercept.
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
				receiveCall: vi.fn(),
				endCall: vi.fn(),
				endCallIfMatching: vi.fn()
			}
		};
	}
	if (request === '../utils/videoCallHelpers') {
		return { isVideoCallFromMatrixInviteContent: () => false };
	}
	return originalLoad.apply(this, args);
};

type Listener = (...args: any[]) => void;

const MY_USER_ID = '@me:matrix.oriso.org';
const ADMIN_USER_ID = '@admin:matrix.oriso.org';
const ROOM_ID = '!room:matrix.oriso.org';

const createFakeMatrixClient = (userId = MY_USER_ID) => {
	const listeners = new Map<string, Set<Listener>>();
	return {
		on: (event: string, listener: Listener) => {
			if (!listeners.has(event)) listeners.set(event, new Set());
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

const makeTimelineEvent = (
	type: string,
	content: Record<string, any> = {}
) => ({
	getType: () => type,
	getContent: () => content,
	getSender: () => ADMIN_USER_ID,
	getTs: () => Date.now(),
	getId: () => '$evt:matrix.oriso.org',
	on: () => undefined,
	off: () => undefined
});

const room = { roomId: ROOM_ID };

describe('MatrixLiveEventBridge — feed update signal (P2)', () => {
	let bridge: MatrixLiveEventBridge;
	let client: ReturnType<typeof createFakeMatrixClient>;

	beforeEach(() => {
		bridge = new MatrixLiveEventBridge();
		client = createFakeMatrixClient();
	});

	afterEach(() => {
		bridge.destroy();
	});

	it('uses the agreed content-free event type', () => {
		expect(FEED_UPDATE_EVENT_TYPE).toBe('org.oriso.feed.updated');
	});

	it('attaches a to-device listener on initialize', () => {
		bridge.initialize(client as any);

		expect(client.listenerCount('receivedToDeviceMessage')).toBe(1);
	});

	it('emits the feed-update bridge event for a to-device signal', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on(FEED_UPDATE_BRIDGE_EVENT, callback);

		client.emit('receivedToDeviceMessage', {
			message: {
				type: FEED_UPDATE_EVENT_TYPE,
				sender: ADMIN_USER_ID,
				content: {}
			},
			encryptionInfo: null
		});

		expect(callback).toHaveBeenCalledTimes(1);
		// Signal is a nudge only: it must not carry notification content.
		expect(Object.keys(callback.mock.calls[0][0] ?? {})).toEqual([
			'timestamp'
		]);
	});

	it('ignores unrelated to-device message types', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on(FEED_UPDATE_BRIDGE_EVENT, callback);

		client.emit('receivedToDeviceMessage', {
			message: {
				type: 'm.room_key',
				sender: ADMIN_USER_ID,
				content: { foo: 'bar' }
			}
		});
		client.emit('receivedToDeviceMessage', undefined);
		client.emit('receivedToDeviceMessage', { message: null });

		expect(callback).not.toHaveBeenCalled();
	});

	it('also accepts the signal from the room timeline', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on(FEED_UPDATE_BRIDGE_EVENT, callback);

		client.emit(
			'Room.timeline',
			makeTimelineEvent(FEED_UPDATE_EVENT_TYPE),
			room,
			false
		);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('ignores a historical room-timeline copy of the signal', () => {
		bridge.initialize(client as any);
		const callback = vi.fn();
		bridge.on(FEED_UPDATE_BRIDGE_EVENT, callback);

		client.emit(
			'Room.timeline',
			makeTimelineEvent(FEED_UPDATE_EVENT_TYPE),
			room,
			true
		);

		expect(callback).not.toHaveBeenCalled();
	});

	it('does not raise a directMessage event for the signal', () => {
		bridge.initialize(client as any);
		const directMessage = vi.fn();
		bridge.on('directMessage', directMessage);

		client.emit('receivedToDeviceMessage', {
			message: { type: FEED_UPDATE_EVENT_TYPE, content: {} }
		});

		expect(directMessage).not.toHaveBeenCalled();
	});

	it('detaches the to-device listener again', () => {
		bridge.initialize(client as any);
		bridge.detach();

		expect(client.listenerCount('receivedToDeviceMessage')).toBe(0);
	});
});
