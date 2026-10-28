// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { getMatrixClientService } from '../services/matrixClientRegistry';
import { useGroupCardMembers } from './useGroupCardMembers';

vi.mock('../services/matrixClientRegistry', () => ({
	getMatrixClientService: vi.fn()
}));
afterEach(cleanup);

const setup = () => {
	const listeners = new Map<string, Set<(...args: any[]) => void>>();
	let members = [
		{ userId: '@bart:example.org', name: 'Bart', membership: 'join' }
	];
	let finish: () => void = () => {};
	const room = {
		roomId: '!group:example.org',
		loadMembersIfNeeded: vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finish = () => resolve(true);
				})
		),
		getJoinedMembers: () => members
	};
	const client = {
		getRoom: () => room,
		on: (name: string, listener: (...args: any[]) => void) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener);
		},
		off: (name: string, listener: (...args: any[]) => void) =>
			listeners.get(name)?.delete(listener)
	};
	let change: (client: any) => void = () => {};
	vi.mocked(getMatrixClientService).mockReturnValue({
		getClient: () => client,
		onClientChange: (listener: typeof change) => {
			change = listener;
			return vi.fn();
		}
	} as any);
	return {
		room,
		client,
		finish: () => finish(),
		setMembers: (next: typeof members) => {
			members = next;
		},
		emit: (name = 'RoomState.members', id = room.roomId) =>
			listeners.get(name)?.forEach((fn) => fn({}, { roomId: id })),
		emitRoom: () => listeners.get('Room')?.forEach((fn) => fn(room)),
		emitSync: (state: string, previous: string) =>
			listeners.get('sync')?.forEach((fn) => fn(state, previous)),
		replace: (replacement: any) => change(replacement)
	};
};

describe('useGroupCardMembers (#1806)', () => {
	it('does not expose partial counts; loads once per room across cards, then stays live', async () => {
		const fixture = setup();
		const { result, rerender } = renderHook(
			({ enabled }) => {
				const first = useGroupCardMembers(
					'!group:example.org',
					enabled
				);
				const second = useGroupCardMembers(
					'!group:example.org',
					enabled
				);
				return { first, second };
			},
			{ initialProps: { enabled: true } }
		);
		expect(result.current.first.status).toBe('loading');
		expect(result.current.first.members).toEqual([]);
		await waitFor(() =>
			expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(1)
		);
		await act(async () => fixture.finish());
		expect(result.current.first.status).toBe('ready');
		expect(result.current.second.members).toHaveLength(1);
		fixture.setMembers([]);
		act(() => fixture.emit());
		expect(result.current.first).toMatchObject({
			status: 'ready',
			members: []
		});
		rerender({ enabled: true });
		expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(1);
		rerender({ enabled: false });
		expect(result.current.first.members).toEqual([]);
	});

	it('never loads a non-group or locked card', () => {
		const fixture = setup();
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', false)
		);
		expect(fixture.room.loadMembersIfNeeded).not.toHaveBeenCalled();
		expect(result.current.status).toBe('loading');
	});

	it('reports failure separately from a real empty room', async () => {
		const fixture = setup();
		fixture.room.loadMembersIfNeeded.mockRejectedValueOnce(
			new Error('offline')
		);
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', true)
		);
		await waitFor(() => expect(result.current.status).toBe('error'));
		expect(result.current.members).toEqual([]);
	});

	it('retries a failed hydration after reconnect, without retrying on member churn', async () => {
		const fixture = setup();
		fixture.room.loadMembersIfNeeded
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(true);
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', true)
		);
		await waitFor(() => expect(result.current.status).toBe('error'));
		act(() => fixture.emit());
		expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(1);
		act(() => fixture.emitSync('SYNCING', 'ERROR'));
		await waitFor(() => expect(result.current.status).toBe('ready'));
		expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(2);
	});

	it('keeps membership live after a room-availability retry succeeds', async () => {
		const fixture = setup();
		fixture.room.loadMembersIfNeeded
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(true);
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', true)
		);
		await waitFor(() => expect(result.current.status).toBe('error'));
		act(() => fixture.emitRoom());
		await waitFor(() => expect(result.current.status).toBe('ready'));
		fixture.setMembers([]);
		act(() => fixture.emit());
		expect(result.current.members).toEqual([]);
	});

	it('hides old members when the client changes and ignores unrelated room updates', async () => {
		const fixture = setup();
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', true)
		);
		await waitFor(() =>
			expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(1)
		);
		await act(async () => fixture.finish());
		await waitFor(() => expect(result.current.status).toBe('ready'));
		fixture.setMembers([]);
		act(() => fixture.emit('RoomState.members', '!other:example.org'));
		expect(result.current.members).toHaveLength(1);
		act(() => fixture.replace(null));
		expect(result.current.members).toEqual([]);
		expect(result.current.status).toBe('loading');
	});
	it('does not publish a delayed load after an account/client change', async () => {
		const fixture = setup();
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', true)
		);
		await waitFor(() =>
			expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(1)
		);
		act(() => fixture.replace(null));
		await act(async () => fixture.finish());
		expect(result.current).toMatchObject({
			status: 'loading',
			members: []
		});
	});

	it('bounds distinct room hydration to two requests in flight', async () => {
		let active = 0;
		let maximum = 0;
		const releases: (() => void)[] = [];
		const load = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					active++;
					maximum = Math.max(maximum, active);
					releases.push(() => {
						active--;
						resolve(true);
					});
				})
		);
		const rooms = Array.from({ length: 3 }, () => ({
			loadMembersIfNeeded: load,
			getJoinedMembers: () => []
		}));
		const client = {
			getRoom: (id: string) => rooms[Number(id)],
			on: vi.fn(),
			off: vi.fn()
		};
		vi.mocked(getMatrixClientService).mockReturnValue({
			getClient: () => client,
			onClientChange: () => vi.fn()
		} as any);
		const { result } = renderHook(() => [
			useGroupCardMembers('0', true),
			useGroupCardMembers('1', true),
			useGroupCardMembers('2', true)
		]);
		await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
		await act(async () => {
			releases.shift()!();
		});
		await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
		await act(async () => {
			releases.splice(0).forEach((release) => release());
		});
		await waitFor(() =>
			expect(
				result.current.every((room) => room.status === 'ready')
			).toBe(true)
		);
		expect(maximum).toBe(2);
	});
	it('keeps the replacement room live when the old room finishes hydration last', async () => {
		const fixture = setup();
		let members = [
			{ userId: '@homer:example.org', name: 'Homer', membership: 'join' }
		];
		const replacement = {
			...fixture.room,
			loadMembersIfNeeded: vi.fn().mockResolvedValue(true),
			getJoinedMembers: () => members
		};
		let currentRoom = fixture.room;
		vi.spyOn(fixture.client, 'getRoom').mockImplementation(
			() => currentRoom
		);
		const { result } = renderHook(() =>
			useGroupCardMembers('!group:example.org', true)
		);
		await waitFor(() =>
			expect(fixture.room.loadMembersIfNeeded).toHaveBeenCalledTimes(1)
		);
		currentRoom = replacement;
		act(() => fixture.emitRoom());
		await waitFor(() =>
			expect(result.current.members[0]?.userId).toBe('@homer:example.org')
		);
		await act(async () => fixture.finish());
		members = [];
		act(() => fixture.emit());
		expect(result.current).toMatchObject({ status: 'ready', members: [] });
		expect(replacement.loadMembersIfNeeded).toHaveBeenCalledTimes(1);
	});
});
