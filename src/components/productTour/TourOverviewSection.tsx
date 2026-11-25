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
import { useAppConfig } from '../../hooks/useAppConfig';
import { useResponsive } from '../../hooks/useResponsive';
import { canUsePractice } from '../../practice/practiceAccess';
import { canStartPracticeTourInViewport } from '../../practice/practiceViewport';
import { isPracticeTourOffered } from '../../practice/practiceTourOffer';
import { practiceSupervisionTour } from '../../practice/practiceTours';

/**
 * FE#2545: "Supervision" exists only as practice. Its card sits after
 * "Fälle übergeben", only where the practice area is open to the counsellor
 * and the tenant can offer it (one-on-one supervision on); elsewhere it is
 * hidden, as a flow the counsellor can do nothing about.
 */
const withPracticeOnlyTopicTours = (
	tours: TourDefinition[],
	practiceOpen: boolean,
	flags: Record<string, unknown>
): TourDefinition[] => {
	if (
		!practiceOpen ||
		!isPracticeTourOffered(practiceSupervisionTour, flags)
	) {
		return tours;
	}
	const after = tours.findIndex(
		(tour) => tour.id === 'consultant-case-handover'
	);
	const at = after === -1 ? tours.length : after + 1;
	return [...tours.slice(0, at), practiceSupervisionTour, ...tours.slice(at)];
};

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
	const settings = useAppConfig();
	const { untilM: isPhone, fromXL: isWideDesktop } = useResponsive();
	const tenantSettings = useTenant()?.settings;
	const audience = audienceForUser(userData);
	const practiceOpen = canUsePractice(settings, userData);
	const tours = useMemo(() => {
		const flags = { ...tenantSettings };
		return getAvailableTours(
			withPracticeOnlyTopicTours(frontendTours, practiceOpen, flags),
			audience,
			{ flags, userData }
		);
	}, [audience, practiceOpen, tenantSettings, userData]);

	// The practice needs the desktop width (as the practice cards): below it
	// the card stays, with the hint instead of a start.
	const unavailableHintKey = useCallback(
		(tour: TourDefinition): string | undefined => {
			if (tour !== practiceSupervisionTour) return undefined;
			return canStartPracticeTourInViewport(tour.id, {
				fromL: !isPhone,
				fromXL: isWideDesktop
			})
				? undefined
				: isPhone
					? 'practice.cards.phoneHint'
					: 'practice.cards.windowHint';
		},
		[isPhone, isWideDesktop]
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
			unavailableHintKey={unavailableHintKey}
		/>
	);
};
