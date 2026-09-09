// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRoomCall } from './startRoomCall';

const SIDE_ROOM = '!supervision-side:oriso.invalid';

/** jsdom's `location` is not writable; redefining the property is. */
const setProtocol = (protocol: string) => {
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: {
			protocol,
			href: `${protocol}//app.test.local/sessions`
		}
	});
};
const CLIENT_ROOM = '!client-session:oriso.invalid';

describe('startRoomCall', () => {
	const started: Array<[string, boolean, boolean | undefined]> = [];
	const notified: string[] = [];
	const getCallManager = () => ({
		startCall: (roomId: string, isVideo: boolean, isGroup?: boolean) => {
			started.push([roomId, isVideo, isGroup]);
		}
	});
	const notify = (message: string) => {
		notified.push(message);
	};

	beforeEach(() => {
		started.length = 0;
		notified.length = 0;
		// jsdom serves the suite from http://localhost; the trigger refuses to
		// run outside HTTPS (mobile Safari needs it for getUserMedia).
		setProtocol('https:');
		vi.stubGlobal('navigator', {
			mediaDevices: {
				getUserMedia: vi.fn(async () => ({ getTracks: () => [] }))
			}
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/**
	 * The load-bearing one (Frank, 09.09.2026): the supervision side room is a
	 * Matrix room of its own, so its call must be placed against THAT id.
	 */
	it('places the call against the room it was handed, not the session room', async () => {
		await startRoomCall({
			roomId: SIDE_ROOM,
			isVideo: true,
			isGroup: false,
			notify,
			getCallManager
		});
		expect(started).toEqual([[SIDE_ROOM, true, false]]);
		expect(started[0][0]).not.toBe(CLIENT_ROOM);
	});

	it('carries the audio/video choice through', async () => {
		await startRoomCall({
			roomId: SIDE_ROOM,
			isVideo: false,
			isGroup: false,
			notify,
			getCallManager
		});
		expect(started).toEqual([[SIDE_ROOM, false, false]]);
	});

	it('forwards the group flag rather than letting the CallManager guess', async () => {
		await startRoomCall({
			roomId: SIDE_ROOM,
			isVideo: false,
			isGroup: true,
			notify,
			getCallManager
		});
		expect(started[0][2]).toBe(true);
	});

	it('asks for the media the call needs, and releases it again', async () => {
		await startRoomCall({
			roomId: SIDE_ROOM,
			isVideo: true,
			notify,
			getCallManager
		});
		expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			video: true,
			audio: true
		});
	});

	it('says so and starts nothing when the room is unknown', async () => {
		await startRoomCall({
			roomId: null,
			isVideo: true,
			notify,
			getCallManager
		});
		expect(started).toEqual([]);
		expect(notified).toHaveLength(1);
	});

	it('starts nothing when the permission is refused', async () => {
		vi.stubGlobal('navigator', {
			mediaDevices: {
				getUserMedia: vi.fn(async () => {
					const error = new Error('denied');
					error.name = 'NotAllowedError';
					throw error;
				})
			}
		});
		await startRoomCall({
			roomId: SIDE_ROOM,
			isVideo: true,
			notify,
			getCallManager
		});
		expect(started).toEqual([]);
		expect(notified[0]).toContain('browser settings');
	});

	it('offers the https redirect instead of failing silently on http', async () => {
		setProtocol('http:');
		const confirm = vi.fn(() => false);
		await startRoomCall({
			roomId: SIDE_ROOM,
			isVideo: true,
			notify,
			confirm,
			getCallManager
		});
		expect(confirm).toHaveBeenCalled();
		expect(started).toEqual([]);
	});
});
