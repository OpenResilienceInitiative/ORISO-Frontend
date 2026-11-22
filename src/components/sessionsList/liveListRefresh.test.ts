import { describe, expect, it, vi } from 'vite-plus/test';
import {
	createRefreshThrottle,
	createRoomRefreshQueue,
	isRoomInSessions,
	lookUpSessionRooms
} from './liveListRefresh';

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

describe('createRoomRefreshQueue (#2480: one lookup per burst, not per message)', () => {
	it('hands over a burst of messages from 14 rooms as one de-duplicated list', () => {
		vi.useFakeTimers();
		try {
			const flush = vi.fn();
			const queue = createRoomRefreshQueue(flush, 300);
			// The Dev page load: 104 message events across 14 rooms.
			for (let i = 0; i < 104; i += 1) queue.add(`!room-${i % 14}:oriso`);
			expect(flush).not.toHaveBeenCalled();

			vi.advanceTimersByTime(300);

			expect(flush).toHaveBeenCalledOnce();
			expect(flush.mock.calls[0][0]).toHaveLength(14);
		} finally {
			vi.useRealTimers();
		}
	});

	it('starts a new window for a message after the flush, and cancel drops the queue', () => {
		vi.useFakeTimers();
		try {
			const flush = vi.fn();
			const queue = createRoomRefreshQueue(flush, 300);
			queue.add('!a:oriso');
			vi.advanceTimersByTime(300);
			queue.add('!b:oriso');
			vi.advanceTimersByTime(300);
			expect(flush.mock.calls).toEqual([[['!a:oriso']], [['!b:oriso']]]);

			queue.add('!c:oriso');
			queue.cancel();
			vi.advanceTimersByTime(300);
			expect(flush).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('lookUpSessionRooms (#2480: batched room lookup)', () => {
	const session = (roomId: string) => ({ session: { matrixRoomId: roomId } });
	const chat = (roomId: string) => ({ chat: { matrixRoomId: roomId } });

	it('answers many rooms with one request', async () => {
		const fetchRooms = vi.fn(async (ids: string[]) => ({
			sessions: ids.map((id) =>
				id.startsWith('!chat') ? chat(id) : session(id)
			)
		}));

		const found = await lookUpSessionRooms(
			['!s1:oriso', '!chat1:oriso', '!s2:oriso'],
			fetchRooms
		);

		expect(fetchRooms).toHaveBeenCalledOnce();
		expect(found.get('!chat1:oriso')).toEqual(chat('!chat1:oriso'));
		expect(found.get('!s2:oriso')).toEqual(session('!s2:oriso'));
	});

	it('asks a room the batch did not answer on its own, and reports a closed room as null', async () => {
		const fetchRooms = vi.fn(async (ids: string[]) =>
			ids.length > 1
				? { sessions: [session('!open:oriso')] }
				: { sessions: [] }
		);

		const found = await lookUpSessionRooms(
			['!open:oriso', '!closed:oriso'],
			fetchRooms
		);

		expect(fetchRooms.mock.calls.map(([ids]) => ids)).toEqual([
			['!open:oriso', '!closed:oriso'],
			['!closed:oriso']
		]);
		expect(found.get('!open:oriso')).toEqual(session('!open:oriso'));
		expect(found.get('!closed:oriso')).toBeNull();
	});

	it('falls back to one request per room when the batch fails', async () => {
		const fetchRooms = vi.fn(async (ids: string[]) => {
			if (ids.length > 1) throw new Error('batch failed');
			if (ids[0] === '!broken:oriso') throw new Error('room failed');
			return { sessions: [session(ids[0])] };
		});

		const found = await lookUpSessionRooms(
			['!a:oriso', '!broken:oriso'],
			fetchRooms
		);

		expect(fetchRooms).toHaveBeenCalledTimes(3);
		expect(found.get('!a:oriso')).toEqual(session('!a:oriso'));
		expect(found.get('!broken:oriso')).toBeNull();
	});

	it('keeps the single-room request unchanged for one room', async () => {
		const fetchRooms = vi.fn(async () => ({
			sessions: [session('!other-id-form:oriso')]
		}));

		const found = await lookUpSessionRooms(['!one:oriso'], fetchRooms);

		expect(fetchRooms).toHaveBeenCalledOnce();
		// As before #2480: the first answer counts, whatever room id it carries.
		expect(found.get('!one:oriso')).toEqual(
			session('!other-id-form:oriso')
		);
	});
});
