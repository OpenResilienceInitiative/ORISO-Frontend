import * as React from 'react';
import { useCallback, useContext, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { TourOverviewCarousel } from './TourOverviewCarousel';
import { frontendTours } from './tourDefinitions';
import { audienceForUser, getAvailableTours } from './tourCatalogue';
import { UserDataContext, useTenant } from '../../globalState';
import { tourLaunchRequestAtom } from './tourLaunchState';
import { versionedTourProgressRepository } from './versionedTourProgressRepository';
import type { TourDefinition } from './types';
import type { TourStartMode } from './TourOverviewCarousel';

/**
 * Help → Rundgänge: the introduction first (counsellors), then the topic
 * tours of the user's role, from the same catalogue the "?" launcher uses.
 */
export const TourOverviewSection = ({
	embedded = false
}: {
	embedded?: boolean;
}) => {
	const requestTourLaunch = useSetAtom(tourLaunchRequestAtom);
	const { userData } = useContext(UserDataContext);
	const tenantSettings = useTenant()?.settings;
	const audience = audienceForUser(userData);
	const tours = useMemo(
		() =>
			getAvailableTours(frontendTours, audience, {
				flags: { ...tenantSettings },
				userData
			}),
		[audience, tenantSettings, userData]
	);

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
			tours={tours}
			embedded={embedded}
			audience={audience ?? 'consultant'}
			loadProgress={loadProgress}
			onStartTour={handleStartTour}
		/>
	);
};
