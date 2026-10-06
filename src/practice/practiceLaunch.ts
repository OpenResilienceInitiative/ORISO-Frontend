import type { TourLaunchRequest } from '../components/productTour/tourLaunchState';
import type { TourStartMode } from '../components/productTour/TourOverviewCarousel';

/**
 * The host (`Walkthrough`) remounts a run when `requestedAt` changes. The
 * clock alone can repeat inside one millisecond, so the stamp always lies
 * after the previous request's.
 */
export const nextPracticeLaunchRequest = (
	tourId: string,
	mode: TourStartMode,
	previous: TourLaunchRequest | null
): TourLaunchRequest => ({
	tourId,
	mode,
	requestedAt: Math.max(Date.now(), (previous?.requestedAt ?? 0) + 1)
});
