/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useThreadRouteHistory } from './useThreadRouteHistory';

const target = {
	scope: 'case-1',
	rootId: '$root',
	hasRoot: false,
	historyReady: true
};

describe('history for a thread deep link', () => {
	it('starts paging only after the initial room timeline loads', async () => {
		const loadEarlier = vi.fn().mockResolvedValue(false);
		const { result, rerender } = renderHook(
			(props) => useThreadRouteHistory({ ...props, loadEarlier }),
			{ initialProps: { ...target, historyReady: false } }
		);

		expect(result.current).toBe('loading');
		expect(loadEarlier).not.toHaveBeenCalled();

		rerender(target);
		await waitFor(() => expect(result.current).toBe('missing'));
		expect(loadEarlier).toHaveBeenCalledTimes(1);

		rerender({ ...target, hasRoot: true });
		expect(result.current).toBeNull();
	});

	it('bounds a missing root search even when the room has more history', async () => {
		const loadEarlier = vi.fn().mockResolvedValue(true);
		const { result } = renderHook(() =>
			useThreadRouteHistory({ ...target, loadEarlier })
		);

		await waitFor(() => expect(result.current).toBe('missing'));
		expect(loadEarlier).toHaveBeenCalledTimes(3);
	});

	it('does not continue paging a conversation after switching away', async () => {
		let resolvePage!: (hasMore: boolean) => void;
		const loadEarlier = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolvePage = resolve;
				})
		);
		const { rerender, result } = renderHook(
			(props: { rootId: string | null }) =>
				useThreadRouteHistory({ ...target, ...props, loadEarlier }),
			{ initialProps: { rootId: '$root' } }
		);
		await waitFor(() => expect(loadEarlier).toHaveBeenCalledTimes(1));

		rerender({ rootId: null });
		resolvePage(true);
		await Promise.resolve();
		expect(loadEarlier).toHaveBeenCalledTimes(1);
		expect(result.current).toBeNull();
	});

	it('reports a failed history lookup without opening a different thread', async () => {
		const loadEarlier = vi.fn().mockRejectedValue(new Error('offline'));
		const { result } = renderHook(() =>
			useThreadRouteHistory({ ...target, loadEarlier })
		);

		await waitFor(() => expect(result.current).toBe('error'));
	});

	it('shows loading while retrying the same thread after leaving it', async () => {
		let resolveRetry!: (hasMore: boolean) => void;
		const loadEarlier = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockImplementationOnce(
				() =>
					new Promise<boolean>((resolve) => {
						resolveRetry = resolve;
					})
			);
		const { rerender, result } = renderHook(
			(props: { rootId: string | null; hasRoot: boolean }) =>
				useThreadRouteHistory({ ...target, ...props, loadEarlier }),
			{ initialProps: { rootId: '$root', hasRoot: false } }
		);
		await waitFor(() => expect(result.current).toBe('error'));

		rerender({ rootId: null, hasRoot: false });
		expect(result.current).toBeNull();
		rerender({ rootId: '$root', hasRoot: false });
		expect(loadEarlier).toHaveBeenCalledTimes(2);
		expect(result.current).toBe('loading');

		rerender({ rootId: '$root', hasRoot: true });
		await act(async () => resolveRetry(true));
		expect(result.current).toBeNull();
		expect(loadEarlier).toHaveBeenCalledTimes(2);
	});
});
