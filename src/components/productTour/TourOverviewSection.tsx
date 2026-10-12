import * as React from 'react';
import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { TourOverviewCarousel } from './TourOverviewCarousel';
import { consultantWalkthroughTour } from './tourDefinitions';
import { tourLaunchRequestAtom } from './tourLaunchState';
import { versionedTourProgressRepository } from './versionedTourProgressRepository';
import type { TourDefinition } from './types';
import type { TourStartMode } from './TourOverviewCarousel';

/** The Help introduction uses the same versioned progress and launch host as before. */
export const TourOverviewSection = ({
	embedded = false
}: {
	embedded?: boolean;
}) => {
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
			tours={[consultantWalkthroughTour]}
			embedded={embedded}
			audience="consultant"
			loadProgress={loadProgress}
			onStartTour={handleStartTour}
		/>
	);
};
