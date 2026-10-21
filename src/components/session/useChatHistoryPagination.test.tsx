// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { useChatHistoryPagination } from './useChatHistoryPagination';

afterEach(cleanup);

it.each([false, true])(
	'preserves navigation during a delayed page when the scroll event has fired: %s',
	async (dispatchScroll) => {
		const container = document.createElement('div');
		container.style.setProperty('overflow-anchor', 'auto', 'important');
		let prependedHeight = 0;
		Object.defineProperties(container, {
			clientHeight: { value: 500 },
			scrollHeight: { get: () => 2000 + prependedHeight }
		});
		container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
		(
			[
				['121', 0],
				['140', 1800]
			] as const
		).forEach(([id, offset]) => {
			const message = document.createElement('div');
			message.dataset.messageId = id;
			message.getBoundingClientRect = () => {
				const top = prependedHeight + offset - container.scrollTop;
				return { top, bottom: top + 80 } as DOMRect;
			};
			container.appendChild(message);
		});
		let resolve!: (hasMore: boolean) => void;
		const pending = new Promise<boolean>((done) => {
			resolve = done;
		});
		const load = vi.fn(() => pending);
		const timeline = { current: container };
		const { result, rerender } = renderHook(
			({ count }) => useChatHistoryPagination(timeline, 1, count, load),
			{ initialProps: { count: 20 } }
		);
		act(() => result.current());
		expect(container.style.getPropertyValue('overflow-anchor')).toBe(
			'none'
		);
		// Browser scroll geometry can change before its queued scroll event runs.
		container.scrollTop = 1500;
		if (dispatchScroll) container.dispatchEvent(new Event('scroll'));
		const newest = container.lastElementChild as HTMLElement;
		const chosenTop = newest.getBoundingClientRect().top;
		await act(async () => {
			prependedHeight = 2000;
			rerender({ count: 69 });
			resolve(true);
			await pending;
		});
		expect(newest.getBoundingClientRect().top).toBe(chosenTop);
		expect(load).toHaveBeenCalledTimes(1);
		expect(container.style.getPropertyValue('overflow-anchor')).toBe(
			'auto'
		);
		expect(container.style.getPropertyPriority('overflow-anchor')).toBe(
			'important'
		);
	}
);

it("does not restore an old page's anchoring over a new page after cancellation", async () => {
	const container = document.createElement('div');
	container.style.setProperty('overflow-anchor', 'auto');
	Object.defineProperties(container, {
		clientHeight: { value: 500 },
		scrollHeight: { value: 2000 }
	});
	const timeline = { current: container };
	let rejectFirst!: (error: Error) => void;
	const first = new Promise<boolean>((_, reject) => {
		rejectFirst = reject;
	});
	const firstLoad = () => first;
	const old = renderHook(() =>
		useChatHistoryPagination(timeline, 1, 20, firstLoad)
	);
	act(() => old.result.current());
	old.unmount();
	expect(container.style.getPropertyValue('overflow-anchor')).toBe('auto');
	let resolveSecond!: (hasMore: boolean) => void;
	const second = new Promise<boolean>((resolve) => {
		resolveSecond = resolve;
	});
	const secondLoad = () => second;
	const current = renderHook(() =>
		useChatHistoryPagination(timeline, 2, 20, secondLoad)
	);
	act(() => current.result.current());
	await act(async () => {
		rejectFirst(new Error('Old request failed'));
		await first.catch(() => undefined);
	});
	expect(container.style.getPropertyValue('overflow-anchor')).toBe('none');
	await act(async () => {
		resolveSecond(false);
		await second;
	});
	expect(container.style.getPropertyValue('overflow-anchor')).toBe('auto');
});
