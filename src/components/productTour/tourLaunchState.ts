import { atom } from 'jotai';
import type { TourStartMode } from './TourOverviewCarousel';

export interface TourLaunchRequest {
	tourId: string;
	mode: TourStartMode;
	/** Monotonic marker so an identical re-request still remounts the tour. */
	requestedAt: number;
}

/**
 * Cross-surface signal from the profile carousel to the tour host: the
 * carousel requests a run, the host (Walkthrough) renders it.
 */
export const tourLaunchRequestAtom = atom(null as TourLaunchRequest | null);
