/**
 * The real composer docks to the bottom of its positioned ancestor and
 * sizes itself (drag handle, toolbar, attachment mode…). Anything that
 * floats "above the composer" — the channel switcher FAB — asks this hook
 * how far from the container's bottom edge the composer's card starts.
 */
import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

export const COMPOSER_FALLBACK_HEIGHT = 212;
export const FAB_GAP = 16;

export const useDockedComposerOffset = (
	containerRef: RefObject<HTMLElement | null>,
	fallback = COMPOSER_FALLBACK_HEIGHT + FAB_GAP
): number => {
	const [offset, setOffset] = useState(fallback);

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		// The composer card plus whatever it docks above itself (the phone
		// navigator row); the topmost edge is what the FAB must clear.
		const composerParts = () =>
			Array.from(
				container.querySelectorAll<HTMLElement>(
					'.textarea__wrapper-send-message, .textarea__mobileNavigator'
				)
			);
		const measure = () => {
			const parts = composerParts();
			if (parts.length === 0) {
				return;
			}
			const containerBottom = container.getBoundingClientRect().bottom;
			const top = Math.min(
				...parts.map((part) => part.getBoundingClientRect().top)
			);
			setOffset(
				Math.max(FAB_GAP, Math.round(containerBottom - top) + FAB_GAP)
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		composerParts().forEach((part) => observer.observe(part));
		// Parts mount after the first paint (TipTap, mobile navigator).
		const mutations = new MutationObserver(() => {
			measure();
			composerParts().forEach((part) => observer.observe(part));
		});
		mutations.observe(container, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			mutations.disconnect();
		};
	}, [containerRef]);

	return offset;
};
