/**
 * Wires `scrollableBar.ts` to a toolbar element (review v6, T22):
 * `data-overflow-start` / `data-overflow-end` for the edge fades, kept
 * fresh on scroll, resize and when buttons come and go; a non-passive
 * wheel listener that scrolls the bar sideways for mouse users.
 */
import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { canScrollBy, overflowEdges, wheelToHorizontal } from './scrollableBar';

export const useScrollableBar = (ref: RefObject<HTMLElement | null>) => {
	useLayoutEffect(() => {
		const bar = ref.current;
		if (!bar) {
			return undefined;
		}
		const update = () => {
			const edges = overflowEdges(bar);
			bar.dataset.overflowStart = String(edges.start);
			bar.dataset.overflowEnd = String(edges.end);
		};
		const onWheel = (event: WheelEvent) => {
			const delta = wheelToHorizontal(event);
			if (delta === null || !canScrollBy(bar, delta)) {
				return;
			}
			event.preventDefault();
			bar.scrollLeft += delta;
		};
		update();
		bar.addEventListener('scroll', update, { passive: true });
		bar.addEventListener('wheel', onWheel, { passive: false });
		const resizes =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(update);
		resizes?.observe(bar);
		const children =
			typeof MutationObserver === 'undefined'
				? null
				: new MutationObserver(update);
		children?.observe(bar, { childList: true });
		return () => {
			bar.removeEventListener('scroll', update);
			bar.removeEventListener('wheel', onWheel);
			resizes?.disconnect();
			children?.disconnect();
		};
	}, [ref]);
};
