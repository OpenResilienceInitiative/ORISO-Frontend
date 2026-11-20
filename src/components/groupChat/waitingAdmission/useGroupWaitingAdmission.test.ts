// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { CallKnock } from '../../../api/apiDirectLinks';
import {
	type GroupWaitingAdmissionApi,
	useGroupWaitingAdmission
} from './useGroupWaitingAdmission';
import {
	markCallAutoJoin,
	shouldAutoJoinCall,
	takeCallAutoJoin
} from './callAutoJoin';

const entry = (status: CallKnock['status']): CallKnock => ({
	id: 11,
	status,
	medium: 'VIDEO',
	requestedAt: '2026-11-12T20:00:00Z'
});

const fakeApi = (
	statuses: CallKnock['status'][] = ['PENDING']
): GroupWaitingAdmissionApi => {
	let call = 0;
	return {
		wait: vi.fn(async () =>
			entry(statuses[Math.min(call++, statuses.length - 1)])
		),
		cancel: vi.fn(async () => undefined)
	};
};

afterEach(() => vi.useRealTimers());

describe('useGroupWaitingAdmission (#2237)', () => {
	it('does nothing until the person has agreed and waits', async () => {
		const api = fakeApi();
		const onAdmitted = vi.fn();
		renderHook(() =>
			useGroupWaitingAdmission({
				chatId: 42,
				enabled: false,
				onAdmitted,
				api
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(api.wait).not.toHaveBeenCalled();
	});

	it('says "still here" on every round while the person waits', async () => {
		vi.useFakeTimers();
		const api = fakeApi(['PENDING', 'PENDING', 'PENDING']);
		const { result } = renderHook(() =>
			useGroupWaitingAdmission({
				chatId: 42,
				enabled: true,
				onAdmitted: vi.fn(),
				api,
				intervalMs: 3000
			})
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(result.current.phase).toBe('waiting');
		await act(async () => {
			await vi.advanceTimersByTimeAsync(6000);
		});
		expect(api.wait).toHaveBeenCalledTimes(3);
		expect(api.wait).toHaveBeenCalledWith(42);
	});

	it("lets the person in once, on the moderator's click, and stops asking", async () => {
		vi.useFakeTimers();
		const api = fakeApi(['PENDING', 'ADMITTED']);
		const onAdmitted = vi.fn();
		const { result } = renderHook(() =>
			useGroupWaitingAdmission({
				chatId: 42,
				enabled: true,
				onAdmitted,
				api,
				intervalMs: 3000
			})
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(9000);
		});
		expect(onAdmitted).toHaveBeenCalledTimes(1);
		expect(result.current.phase).toBe('admitted');
		expect(api.wait).toHaveBeenCalledTimes(2);
		expect(api.cancel).not.toHaveBeenCalled();
	});

	it('stops waiting when the person leaves the waiting room', async () => {
		const api = fakeApi();
		const { unmount } = renderHook(() =>
			useGroupWaitingAdmission({
				chatId: 42,
				enabled: true,
				onAdmitted: vi.fn(),
				api
			})
		);
		await waitFor(() => expect(api.wait).toHaveBeenCalled());
		unmount();
		expect(api.cancel).toHaveBeenCalledWith(11);
	});

	it('keeps trying after a failed round', async () => {
		vi.useFakeTimers();
		const api = fakeApi(['ADMITTED']);
		(api.wait as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error('offline')
		);
		const onAdmitted = vi.fn();
		renderHook(() =>
			useGroupWaitingAdmission({
				chatId: 42,
				enabled: true,
				onAdmitted,
				api,
				intervalMs: 3000
			})
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3500);
		});
		expect(onAdmitted).toHaveBeenCalledTimes(1);
	});
});

describe('callAutoJoin (#2237)', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
	});

	it('marks the group so its running call is joined once', () => {
		markCallAutoJoin(42);
		expect(shouldAutoJoinCall(42)).toBe(true);
		expect(shouldAutoJoinCall(7)).toBe(false);
		expect(takeCallAutoJoin(42)).toBe(true);
		expect(takeCallAutoJoin(42)).toBe(false);
		expect(shouldAutoJoinCall(42)).toBe(false);
	});

	it('forgets an old mark', () => {
		const now = Date.now();
		markCallAutoJoin(42, now - 11 * 60_000);
		expect(shouldAutoJoinCall(42, now)).toBe(false);
	});
});
