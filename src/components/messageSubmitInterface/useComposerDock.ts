/**
 * The composer is absolutely positioned over its timeline, so the timeline
 * has to keep that much room free at its bottom. That reservation used to be
 * a constant in SCSS (240 px, 320 px below 1366 px, 200 px on the phone)
 * while the real composer is anything between one resting line and two
 * thirds of the window — an info bar, a reply preview, auto-grow and the
 * drag handle all move it.
 *
 * This hook measures the docked composer and publishes two numbers on its
 * host (the chat card or the side panel):
 *
 * - `--composer-dock-height`: what the timeline must keep free;
 * - `--composer-host-height`: the host's own height, so the composer can cap
 *   its growth at what the pane actually has (T41).
 */
import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Same hosts `scrollToNewest` knows: a side panel, else the chat card. */
export const COMPOSER_HOST_SELECTOR = '.sidePanel, .session, .enquiry__wrapper';

/**
 * The scrolling timeline inside that host. It is what the composer lies over,
 * so it — not the whole card, which also carries the header — is the space
 * the two of them share.
 */
export const COMPOSER_TIMELINE_SELECTOR =
	'.sidePanel__timeline, .session__content';

export const findComposerHost = (from: Element | null): HTMLElement | null =>
	(from?.closest(COMPOSER_HOST_SELECTOR) as HTMLElement | null) ?? null;

export const useComposerDock = (
	wrapperRef: RefObject<HTMLElement | null>
): number => {
	const [hostHeight, setHostHeight] = useState(0);

	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const host = findComposerHost(wrapper);
		if (!wrapper || !host || typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const measure = () => {
			const dock = Math.round(wrapper.getBoundingClientRect().height);
			const timeline = host.querySelector<HTMLElement>(
				COMPOSER_TIMELINE_SELECTOR
			);
			const shared = Math.round(
				(timeline ?? host).getBoundingClientRect().height
			);
			host.style.setProperty('--composer-dock-height', `${dock}px`);
			host.style.setProperty('--composer-host-height', `${shared}px`);
			setHostHeight(shared);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(wrapper);
		observer.observe(host);
		return () => {
			observer.disconnect();
			host.style.removeProperty('--composer-dock-height');
			host.style.removeProperty('--composer-host-height');
		};
	}, [wrapperRef]);

	return hostHeight;
};
