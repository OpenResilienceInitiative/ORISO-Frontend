import { describe, expect, it } from 'vitest';
import { createRefreshThrottle, isRoomInSessions } from './liveListRefresh';

const sessions = [
	{ session: { matrixRoomId: '!known-session:oriso' } },
	{ chat: { matrixRoomId: '!known-chat:oriso' } },
	{ session: null, chat: null },
	null
] as never[];

describe('isRoomInSessions (#1206: a message from an unloaded room)', () => {
	it('finds a room the list already holds, as a session or as a chat', () => {
		expect(isRoomInSessions(sessions, '!known-session:oriso')).toBe(true);
		expect(isRoomInSessions(sessions, '!known-chat:oriso')).toBe(true);
	});

	it('reports a brand-new room as unknown — this is the hard-refresh bug', () => {
		// touchSessionsByRids drops unknown rooms, so nothing on screen changes
		// unless the caller refetches the list.
		expect(isRoomInSessions(sessions, '!brand-new:oriso')).toBe(false);
	});

	it('never claims to know an empty room id or an empty list', () => {
		expect(isRoomInSessions(sessions, '')).toBe(false);
		expect(isRoomInSessions([], '!any:oriso')).toBe(false);
		expect(isRoomInSessions(undefined as never, '!any:oriso')).toBe(false);
	});
});

describe('createRefreshThrottle (#1206: one refetch per burst)', () => {
	it('allows the first refresh and blocks a burst inside the window', () => {
		const throttle = createRefreshThrottle(3000);
		expect(throttle.shouldRefresh(1_000)).toBe(true);
		expect(throttle.shouldRefresh(1_500)).toBe(false);
		expect(throttle.shouldRefresh(3_999)).toBe(false);
	});

	it('allows the next refresh once the window has passed', () => {
		const throttle = createRefreshThrottle(3000);
		expect(throttle.shouldRefresh(1_000)).toBe(true);
		expect(throttle.shouldRefresh(4_000)).toBe(true);
		expect(throttle.shouldRefresh(4_100)).toBe(false);
	});

	it('keeps separate throttles independent', () => {
		const a = createRefreshThrottle(3000);
		const b = createRefreshThrottle(3000);
		expect(a.shouldRefresh(1_000)).toBe(true);
		expect(b.shouldRefresh(1_000)).toBe(true);
	});
});
