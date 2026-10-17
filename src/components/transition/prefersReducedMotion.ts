export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The reduced-motion question, read at the moment it is needed. For things that
 * run once on a press (or once on a page load) and have nothing to re-render
 * when the setting changes. It lives apart from `useReducedMotion` so the app's
 * first module can ask it without pulling in the component library.
 */
export const prefersReducedMotion = (
	win: Window | undefined = typeof window === 'undefined' ? undefined : window
): boolean =>
	typeof win?.matchMedia === 'function' &&
	win.matchMedia(REDUCED_MOTION_QUERY).matches;
