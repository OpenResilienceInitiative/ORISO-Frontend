// @vitest-environment oriso-jsdom
/**
 * A moderator removes someone from a Gesprächskreis while its audio or video
 * call runs (ORISO-Admin#1518 follow-up). The ban takes them out of the
 * conversation's Matrix room, but nothing ended their running call: they
 * could stay in it. Their own app now leaves the call as soon as it sees
 * the ban.
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { MatrixRoomLifecycleChange } from '../../services/chatTransportService';
import { chatTransportService } from '../../services/chatTransportService';
import {
	groupConversationRoomOf,
	useLeaveCallWhenRemoved
} from './useLeaveCallWhenRemoved';

vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: {
		onMatrixRoomLifecycle: vi.fn(),
		getMyMatrixRoomMembership: vi.fn(),
		onMatrixInitialSync: vi.fn()
	}
}));

const subscribe = vi.mocked(chatTransportService.onMatrixRoomLifecycle);
const membership = vi.mocked(chatTransportService.getMyMatrixRoomMembership);
const onSynced = vi.mocked(chatTransportService.onMatrixInitialSync);
let emit: (change: MatrixRoomLifecycleChange) => void = () => {};
const unsubscribe = vi.fn();

beforeEach(() => {
	subscribe.mockReset();
	membership.mockReset();
	membership.mockReturnValue('join');
	onSynced.mockReset();
	unsubscribe.mockReset();
	subscribe.mockImplementation((_roomId, listener) => {
		emit = listener;
		return unsubscribe;
	});
});

describe('useLeaveCallWhenRemoved', () => {
	it('leaves a running group call when this person is banned from its conversation', () => {
		const onRemoved = vi.fn();
		renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', true, onRemoved)
		);

		expect(subscribe).toHaveBeenCalledWith(
			'!circle:oriso',
			expect.any(Function)
		);
		emit({
			type: 'myMembership',
			membership: 'ban',
			prevMembership: 'join'
		});

		expect(onRemoved).toHaveBeenCalledWith('ban');
	});

	it('leaves as well when this person is kicked or leaves the conversation', () => {
		const onRemoved = vi.fn();
		renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', true, onRemoved)
		);

		emit({
			type: 'myMembership',
			membership: 'leave',
			prevMembership: 'join'
		});

		expect(onRemoved).toHaveBeenCalledWith('leave');
	});

	it('ignores a stopped conversation, which ends its call by itself', () => {
		const onRemoved = vi.fn();
		renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', true, onRemoved)
		);

		emit({ type: 'tombstoned' });

		expect(onRemoved).not.toHaveBeenCalled();
	});

	it('watches nothing without a running group call', () => {
		renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', false, vi.fn())
		);
		renderHook(() => useLeaveCallWhenRemoved(null, true, vi.fn()));

		expect(subscribe).not.toHaveBeenCalled();
	});

	it('stops watching when the call ends', () => {
		const { rerender } = renderHook(
			({ active }) =>
				useLeaveCallWhenRemoved('!circle:oriso', active, vi.fn()),
			{ initialProps: { active: true } }
		);

		rerender({ active: false });

		expect(unsubscribe).toHaveBeenCalled();
	});

	it('watches the new Matrix client after a token refresh replaced the old one', () => {
		const onRemoved = vi.fn();
		const { rerender } = renderHook(
			({ generation }) =>
				useLeaveCallWhenRemoved(
					'!circle:oriso',
					true,
					onRemoved,
					generation
				),
			{ initialProps: { generation: 0 } }
		);

		rerender({ generation: 1 });

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(subscribe).toHaveBeenCalledTimes(2);
		emit({
			type: 'myMembership',
			membership: 'ban',
			prevMembership: 'join'
		});
		expect(onRemoved).toHaveBeenCalledWith('ban');
	});
});

describe('useLeaveCallWhenRemoved — removal before the watch started', () => {
	it('leaves when the room already shows the ban, e.g. after a client refresh', () => {
		membership.mockReturnValue('ban');
		const onRemoved = vi.fn();

		renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', true, onRemoved, 1)
		);

		expect(membership).toHaveBeenCalledWith('!circle:oriso');
		expect(onRemoved).toHaveBeenCalledWith('ban');
	});

	it('checks again once a refreshed client has finished its first sync', () => {
		membership.mockReturnValue(null);
		let synced = (): void => {};
		const stopWaiting = vi.fn();
		onSynced.mockImplementation((callback) => {
			synced = callback;
			return stopWaiting;
		});
		const onRemoved = vi.fn();
		const { unmount } = renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', true, onRemoved, 1)
		);
		expect(onRemoved).not.toHaveBeenCalled();

		membership.mockReturnValue('leave');
		synced();

		expect(onRemoved).toHaveBeenCalledWith('leave');
		unmount();
		expect(stopWaiting).toHaveBeenCalled();
	});

	it('stays in the call while still a member', () => {
		const onRemoved = vi.fn();
		renderHook(() =>
			useLeaveCallWhenRemoved('!circle:oriso', true, onRemoved)
		);
		expect(onRemoved).not.toHaveBeenCalled();
	});
});

describe('groupConversationRoomOf', () => {
	it('watches the Gesprächskreis room, not the call media room', () => {
		expect(
			groupConversationRoomOf({
				isGroup: true,
				signalRoomId: '!circle:oriso'
			})
		).toBe('!circle:oriso');
	});

	it('watches nothing for a one-to-one call', () => {
		expect(
			groupConversationRoomOf({
				isGroup: false,
				signalRoomId: '!one-to-one:oriso'
			})
		).toBeNull();
		expect(groupConversationRoomOf(null)).toBeNull();
	});
});
