// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	type CallShareLinkKnockApi,
	useCallShareLinkKnock
} from './useCallShareLinkKnock';

const CALL = { sourceRoomId: '!conversation:oriso.example', callId: 'call-1' };

const fakeApi = (
	overrides: Partial<CallShareLinkKnockApi> = {}
): CallShareLinkKnockApi => ({
	get: vi.fn().mockResolvedValue({ id: 7, knock: true }),
	set: vi.fn(async (_id: number, knock: boolean) => knock),
	...overrides
});

afterEach(() => vi.useRealTimers());

describe('useCallShareLinkKnock', () => {
	it('reads the setting of the call link', async () => {
		const api = fakeApi();
		const { result } = renderHook(() =>
			useCallShareLinkKnock({ enabled: true, call: CALL, api })
		);
		await waitFor(() => expect(result.current.knock).toBe(true));
		expect(api.get).toHaveBeenCalledWith(CALL);
	});

	it('is null while the call has no link, and refuses a change', async () => {
		const api = fakeApi({ get: vi.fn().mockResolvedValue(null) });
		const { result } = renderHook(() =>
			useCallShareLinkKnock({ enabled: true, call: CALL, api })
		);
		await waitFor(() => expect(api.get).toHaveBeenCalled());
		expect(result.current.knock).toBeNull();
		await expect(result.current.setKnock(false)).rejects.toThrow();
		expect(api.set).not.toHaveBeenCalled();
	});

	it('asks nothing without a call or when disabled', () => {
		const api = fakeApi();
		renderHook(() =>
			useCallShareLinkKnock({ enabled: true, call: null, api })
		);
		renderHook(() =>
			useCallShareLinkKnock({ enabled: false, call: CALL, api })
		);
		expect(api.get).not.toHaveBeenCalled();
	});

	it('finds a link made later in the share popover', async () => {
		vi.useFakeTimers();
		const get = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ id: 7, knock: false });
		const { result } = renderHook(() =>
			useCallShareLinkKnock({
				enabled: true,
				call: CALL,
				api: fakeApi({ get }),
				intervalMs: 1000
			})
		);
		await act(async () => {});
		expect(result.current.knock).toBeNull();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
		});
		expect(result.current.knock).toBe(false);
	});

	it('changes the link and takes the stored value', async () => {
		const api = fakeApi();
		const { result } = renderHook(() =>
			useCallShareLinkKnock({ enabled: true, call: CALL, api })
		);
		await waitFor(() => expect(result.current.knock).toBe(true));
		await act(async () => {
			await expect(result.current.setKnock(false)).resolves.toBe(false);
		});
		expect(api.set).toHaveBeenCalledWith(7, false);
		expect(result.current.knock).toBe(false);
	});

	it('keeps the old value when the change did not land', async () => {
		const api = fakeApi({
			set: vi.fn().mockRejectedValue(new Error('CATCH_ALL'))
		});
		const { result } = renderHook(() =>
			useCallShareLinkKnock({ enabled: true, call: CALL, api })
		);
		await waitFor(() => expect(result.current.knock).toBe(true));
		await act(async () => {
			await expect(result.current.setKnock(false)).rejects.toThrow();
		});
		expect(result.current.knock).toBe(true);
	});

	it('keeps what it knew when the server does not answer', async () => {
		vi.useFakeTimers();
		const get = vi
			.fn()
			.mockResolvedValueOnce({ id: 7, knock: true })
			.mockRejectedValue(new Error('CATCH_ALL'));
		const { result } = renderHook(() =>
			useCallShareLinkKnock({
				enabled: true,
				call: CALL,
				api: fakeApi({ get }),
				intervalMs: 1000
			})
		);
		await act(async () => {});
		expect(result.current.knock).toBe(true);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
		});
		expect(get).toHaveBeenCalledTimes(2);
		expect(result.current.knock).toBe(true);
	});
});
