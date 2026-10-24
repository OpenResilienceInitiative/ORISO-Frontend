import { useMediaQuery } from '@mui/material';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the person asked the system for less motion. */
export const useReducedMotion = (): boolean =>
	useMediaQuery(REDUCED_MOTION_QUERY);

/**
 * The same answer, read at the moment it is needed. For things that run once
 * on a press and have nothing to re-render when the setting changes.
 */
export const prefersReducedMotion = (
	win: Window | undefined = typeof window === 'undefined' ? undefined : window
): boolean =>
	typeof win?.matchMedia === 'function' &&
	win.matchMedia(REDUCED_MOTION_QUERY).matches;
