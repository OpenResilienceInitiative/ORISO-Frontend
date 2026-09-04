/**
 * WP-B2 — phone layout: the FAB must float above the bottom navigation.
 * Measures `.navigation__wrapper` when it sits at the bottom edge of the
 * viewport (the mobile bar); falls back to a constant when it is a sidebar,
 * missing, or not measurable (SSR, tests).
 */
import { useEffect, useState } from 'react';

/** `$grid-base-nine` (72 px) — the mobile bar height in navigation.styles. */
export const BOTTOM_NAV_FALLBACK_HEIGHT = 72;
/** Breathing room between the bar and the FAB. */
export const BOTTOM_NAV_GAP = 16;

export const measureBottomNavHeight = (
	element: Element | null,
	viewportHeight: number
): number => {
	if (!element || !viewportHeight) {
		return BOTTOM_NAV_FALLBACK_HEIGHT;
	}
	const rect = element.getBoundingClientRect();
	const isBottomBar =
		rect.height > 0 &&
		rect.height < viewportHeight / 2 &&
		Math.abs(rect.bottom - viewportHeight) < 2;
	return isBottomBar ? Math.round(rect.height) : BOTTOM_NAV_FALLBACK_HEIGHT;
};

export const useBottomNavOffset = (enabled: boolean): number => {
	const [offset, setOffset] = useState(
		BOTTOM_NAV_FALLBACK_HEIGHT + BOTTOM_NAV_GAP
	);

	useEffect(() => {
		if (!enabled || typeof window === 'undefined') {
			return undefined;
		}
		const update = () => {
			const nav = document.querySelector('.navigation__wrapper');
			setOffset(
				measureBottomNavHeight(nav, window.innerHeight) + BOTTOM_NAV_GAP
			);
		};
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, [enabled]);

	return offset;
};
