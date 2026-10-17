import { useMediaQuery } from '@mui/material';
import {
	prefersReducedMotion,
	REDUCED_MOTION_QUERY
} from './prefersReducedMotion';

export { prefersReducedMotion };

/** True when the person asked the system for less motion. */
export const useReducedMotion = (): boolean =>
	useMediaQuery(REDUCED_MOTION_QUERY);
