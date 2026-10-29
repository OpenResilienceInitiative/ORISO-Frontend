import { useMediaQuery } from '@mui/material';

/** True when the person asked the system for less motion. */
export const useReducedMotion = (): boolean =>
	useMediaQuery('(prefers-reduced-motion: reduce)');
