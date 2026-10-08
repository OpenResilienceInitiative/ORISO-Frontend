import * as React from 'react';
import { useCallback, useContext, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { UserDataContext, useTenant } from '../globalState';
import { useAppConfig } from '../hooks/useAppConfig';
import { useResponsive } from '../hooks/useResponsive';
import type { TourStartMode } from '../components/productTour/TourOverviewCarousel';
import { tourLaunchRequestAtom } from '../components/productTour/tourLaunchState';
import { versionedTourProgressRepository } from '../components/productTour/versionedTourProgressRepository';
import type { TourDefinition } from '../components/productTour/types';
import { PracticeCards } from './PracticeCards';
import { canUsePractice } from './practiceAccess';
import { nextPracticeLaunchRequest } from './practiceLaunch';
import { isPracticeTourOffered } from './practiceTourOffer';
import { practiceTours } from './practiceTours';

export interface PracticeOverviewSectionProps {
	/** Defaults to the practice tours; stories and tests pass their own. */
	tours?: TourDefinition[];
	/** A subordinate learning area inside the shared Help card. */
	embedded?: boolean;
}

/**
 * Profile → Help → "Meine Rundgänge": the practice flows as manual learning
 * options. Visible to counsellors while the master switch and release flag are
 * on; a flow the Träger switched off (Supervision) is hidden, not greyed. Start
 * is the same launch request the tour cards use; the host does the rest.
 */
export const PracticeOverviewSection = ({
	tours = practiceTours,
	embedded = false
}: PracticeOverviewSectionProps) => {
	const settings = useAppConfig();
	const { userData } = useContext(UserDataContext);
	// Reactive on purpose: a Träger switching a feature while the page is open
	// must show or hide its card (the plain-JS mirror would not re-render).
	const tenantFlags = useTenant()?.settings;
	const { untilM: isPhone, fromXL: isWideDesktop } = useResponsive();
	const requestTourLaunch = useSetAtom(tourLaunchRequestAtom);

	const loadProgress = useCallback(
		() => versionedTourProgressRepository.getProgress(),
		[]
	);

	const handleStartTour = useCallback(
		(tour: TourDefinition, mode: TourStartMode) => {
			requestTourLaunch((previous) =>
				nextPracticeLaunchRequest(tour.id, mode, previous)
			);
		},
		[requestTourLaunch]
	);

	const offered = useMemo(
		() =>
			tours.filter(
				(tour) =>
					tour.surface === 'frontend' &&
					tour.audiences.includes('consultant') &&
					isPracticeTourOffered(tour, { ...tenantFlags })
			),
		[tenantFlags, tours]
	);

	if (!canUsePractice(settings, userData)) {
		return null;
	}

	return (
		<PracticeCards
			embedded={embedded}
			tours={offered}
			isPhone={isPhone}
			isWideDesktop={isWideDesktop}
			loadProgress={loadProgress}
			onStartTour={handleStartTour}
		/>
	);
};
