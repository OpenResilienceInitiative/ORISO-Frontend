/**
 * FE#1435: the "Anfragen" nav badge counts open enquiries. It loads once,
 * reloads when a new enquiry arrives or one is taken here (the enquiry-list
 * refresh signal), and re-checks every 30 s while the tab is visible so an
 * enquiry another counsellor takes drops off as well.
 *
 * @vitest-environment oriso-jsdom
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ENQUIRY_COUNT_POLL_MS,
	useOpenEnquiryCount
} from './useOpenEnquiryCount';
import { messageEventEmitter } from '../../services/messageEventEmitter';

const apiGetConsultantEnquiryCount = vi.fn();
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantEnquiryCount: (...args: unknown[]) =>
		apiGetConsultantEnquiryCount(...args)
}));

let visibility: DocumentVisibilityState = 'visible';

describe('useOpenEnquiryCount (FE#1435)', () => {
	beforeEach(() => {
		apiGetConsultantEnquiryCount.mockReset();
		visibility = 'visible';
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => visibility
		);
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('does nothing for someone who is not a counsellor', () => {
		const { result } = renderHook(() => useOpenEnquiryCount(false));
		expect(result.current).toBeNull();
		expect(apiGetConsultantEnquiryCount).not.toHaveBeenCalled();
	});

	it('loads the count once on mount', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(2);
		const { result } = renderHook(() => useOpenEnquiryCount(true));
		await waitFor(() => expect(result.current).toBe(2));
		expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(1);
	});

	it('goes up when a new enquiry arrives and down when one is taken here', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(0);
		const { result } = renderHook(() => useOpenEnquiryCount(true));
		await waitFor(() => expect(result.current).toBe(0));

		// The feed saw request.new and asks every enquiry consumer to reload.
		apiGetConsultantEnquiryCount.mockResolvedValue(1);
		act(() => {
			messageEventEmitter.emit({
				refreshEnquiryList: true,
				source: 'notification-feed'
			});
		});
		await waitFor(() => expect(result.current).toBe(1));

		// Accepting an enquiry removes its row (sessionId) and reloads lists.
		apiGetConsultantEnquiryCount.mockResolvedValue(0);
		act(() => {
			messageEventEmitter.emit({ sessionId: 246 });
		});
		await waitFor(() => expect(result.current).toBe(0));
	});

	it('ignores plain message traffic', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(1);
		renderHook(() => useOpenEnquiryCount(true));
		await waitFor(() =>
			expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(1)
		);
		act(() => {
			messageEventEmitter.emit({ roomId: '!room', timestamp: 1 });
			messageEventEmitter.emit({});
		});
		expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(1);
	});

	it('re-checks every 30 s while visible, so an enquiry taken by someone else drops off', async () => {
		vi.useFakeTimers();
		apiGetConsultantEnquiryCount.mockResolvedValue(1);
		const { result } = renderHook(() => useOpenEnquiryCount(true));
		await act(async () => {
			await Promise.resolve();
		});
		expect(result.current).toBe(1);

		apiGetConsultantEnquiryCount.mockResolvedValue(0);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(ENQUIRY_COUNT_POLL_MS);
		});
		expect(ENQUIRY_COUNT_POLL_MS).toBe(30000);
		expect(result.current).toBe(0);
		expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(2);

		// A hidden tab does not poll; coming back checks at once.
		visibility = 'hidden';
		await act(async () => {
			await vi.advanceTimersByTimeAsync(ENQUIRY_COUNT_POLL_MS * 2);
		});
		expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(2);
		visibility = 'visible';
		apiGetConsultantEnquiryCount.mockResolvedValue(3);
		await act(async () => {
			document.dispatchEvent(new Event('visibilitychange'));
			await Promise.resolve();
		});
		expect(result.current).toBe(3);
	});

	it('keeps the last count when a reload fails', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(2);
		const { result } = renderHook(() => useOpenEnquiryCount(true));
		await waitFor(() => expect(result.current).toBe(2));

		apiGetConsultantEnquiryCount.mockRejectedValue(new Error('500'));
		act(() => {
			messageEventEmitter.emit({ refreshEnquiryList: true });
		});
		await waitFor(() =>
			expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(2)
		);
		expect(result.current).toBe(2);
	});

	it('stops listening after unmount', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(1);
		const { unmount } = renderHook(() => useOpenEnquiryCount(true));
		await waitFor(() =>
			expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(1)
		);
		unmount();
		messageEventEmitter.emit({ refreshEnquiryList: true });
		expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(1);
	});
});
