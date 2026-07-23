import * as React from 'react';
import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { TourOverviewCarousel } from './TourOverviewCarousel';
import { frontendTours } from './tourDefinitions';
import { tourLaunchRequestAtom } from './tourLaunchState';
import { versionedTourProgressRepository } from './versionedTourProgressRepository';
import type { TourDefinition } from './types';
import type { TourStartMode } from './TourOverviewCarousel';

/**
 * Profile section wiring the tutorial carousel to the versioned progress API
 * and the tour host. Consultant-only for now — the consultant walkthrough is
 * the only shipped frontend tour.
 */
export const TourOverviewSection = () => {
	const requestTourLaunch = useSetAtom(tourLaunchRequestAtom);

	const loadProgress = useCallback(
		() => versionedTourProgressRepository.getProgress(),
		[]
	);

	const handleStartTour = useCallback(
		(tour: TourDefinition, mode: TourStartMode) => {
			requestTourLaunch({
				tourId: tour.id,
				mode,
				requestedAt: Date.now()
			});
		},
		[requestTourLaunch]
	);

	return (
		<TourOverviewCarousel
			tours={frontendTours}
			audience="consultant"
			loadProgress={loadProgress}
			onStartTour={handleStartTour}
		/>
	);
};
