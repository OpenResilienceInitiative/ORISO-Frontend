/* @vitest-environment oriso-jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiGetGroupChatInfo } from '../../api';
import { useGroupCallerBan } from './useGroupCallerBan';

vi.mock('../../api', () => ({ apiGetGroupChatInfo: vi.fn() }));

const group = {
	askerId: 'asker',
	chatId: 15,
	roomId: '!room:oriso',
	active: true
};
const response = { id: 15, active: true, matrixRoomId: group.roomId };

describe('caller ban check for the waiting room', () => {
	beforeEach(() => {
		vi.mocked(apiGetGroupChatInfo).mockReset();
	});
	afterEach(cleanup);

	it('checks once for the current active room and releases a confirmed non-ban', async () => {
		vi.mocked(apiGetGroupChatInfo).mockResolvedValue({
			...response,
			callerBanState: 'NOT_BANNED'
		});
		const { result, rerender } = renderHook(useGroupCallerBan, {
			initialProps: group
		});
		expect(result.current).toBe('PENDING');
		await waitFor(() => expect(result.current).toBe('NOT_BANNED'));
		rerender({ ...group });
		expect(apiGetGroupChatInfo).toHaveBeenCalledTimes(1);
		expect(apiGetGroupChatInfo).toHaveBeenCalledWith(15, {
			includeCallerBan: true,
			signal: expect.any(AbortSignal)
		});
	});

	it.each([{ askerId: undefined }, { active: false }, { roomId: undefined }])(
		'skips the probe without an eligible active asker room (%o)',
		(overrides) => {
			const { result } = renderHook(() =>
				useGroupCallerBan({ ...group, ...overrides })
			);
			expect(result.current).toBe('UNKNOWN');
			expect(apiGetGroupChatInfo).not.toHaveBeenCalled();
		}
	);

	it.each([
		['an old response', response],
		['an unknown state', { ...response, callerBanState: 'UNKNOWN' }],
		[
			'a stale room',
			{
				...response,
				matrixRoomId: '!old:oriso',
				callerBanState: 'BANNED'
			}
		]
	] as const)(
		'falls back to the join request after %s',
		async (_, answer) => {
			vi.mocked(apiGetGroupChatInfo).mockResolvedValue(answer);
			const { result } = renderHook(() => useGroupCallerBan(group));
			await waitFor(() => expect(result.current).toBe('UNKNOWN'));
		}
	);

	it('releases the hold after a failed read', async () => {
		vi.mocked(apiGetGroupChatInfo).mockRejectedValue(new Error('offline'));
		const { result } = renderHook(() => useGroupCallerBan(group));
		await waitFor(() => expect(result.current).toBe('UNKNOWN'));
	});

	it('starts the first lookup when the waiting room becomes active', async () => {
		vi.mocked(apiGetGroupChatInfo).mockResolvedValue({
			...response,
			callerBanState: 'BANNED'
		});
		const { result, rerender } = renderHook(useGroupCallerBan, {
			initialProps: { ...group, active: false }
		});
		expect(apiGetGroupChatInfo).not.toHaveBeenCalled();
		rerender(group);
		expect(result.current).toBe('PENDING');
		await waitFor(() => expect(result.current).toBe('BANNED'));
		rerender({ ...group });
		expect(apiGetGroupChatInfo).toHaveBeenCalledTimes(1);
	});

	it('cancels a lookup on scope change and ignores its late ban', async () => {
		const old =
			Promise.withResolvers<
				Awaited<ReturnType<typeof apiGetGroupChatInfo>>
			>();
		vi.mocked(apiGetGroupChatInfo)
			.mockReturnValueOnce(old.promise)
			.mockResolvedValueOnce({
				...response,
				matrixRoomId: '!new:oriso',
				callerBanState: 'NOT_BANNED'
			});
		const { result, rerender, unmount } = renderHook(useGroupCallerBan, {
			initialProps: group
		});
		const first = vi.mocked(apiGetGroupChatInfo).mock.calls[0][1]?.signal;
		rerender({ ...group, roomId: '!new:oriso' });
		expect(result.current).toBe('PENDING');
		expect(first?.aborted).toBe(true);
		await waitFor(() => expect(result.current).toBe('NOT_BANNED'));
		await act(async () =>
			old.resolve({ ...response, callerBanState: 'BANNED' })
		);
		expect(result.current).toBe('NOT_BANNED');
		const second = vi.mocked(apiGetGroupChatInfo).mock.calls[1][1]?.signal;
		unmount();
		expect(second?.aborted).toBe(true);
	});
});
