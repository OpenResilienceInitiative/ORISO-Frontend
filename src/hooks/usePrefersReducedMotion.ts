import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * One-off read of the same preference, for code outside a render (event
 * handlers, timers). Safe where `matchMedia` is unavailable: returns false,
 * the same fallback as the hook.
 */
export const prefersReducedMotion = (): boolean =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * True when the user has asked the OS to reduce motion, kept in sync with the
 * media query at runtime. Callers can use it to pause animations/cycling. Safe
 * where `matchMedia` is unavailable (older environments, SSR): returns false.
 */
export const usePrefersReducedMotion = (): boolean => {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		if (
			typeof window === 'undefined' ||
			typeof window.matchMedia !== 'function'
		) {
			return;
		}
		const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
		setPrefersReducedMotion(mediaQueryList.matches);
		const listener = (event: MediaQueryListEvent) =>
			setPrefersReducedMotion(event.matches);
		mediaQueryList.addEventListener('change', listener);
		return () => mediaQueryList.removeEventListener('change', listener);
	}, []);

	return prefersReducedMotion;
};
