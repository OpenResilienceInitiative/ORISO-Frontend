import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { UserDataContext } from '../../globalState';
import { useAppConfig } from '../../hooks/useAppConfig';
import { ProductTourAdapter } from '../productTour/ProductTourAdapter';
import { ProductTourTooltip } from '../productTour/ProductTourTooltip';
import {
	consultantWalkthroughTour,
	frontendTours
} from '../productTour/tourDefinitions';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { versionedTourProgressRepository } from '../productTour/versionedTourProgressRepository';
import type {
	TourDefinition,
	TourEvent,
	TourProgress,
	TourStep
} from '../productTour/types';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';

type AutoRunState = 'unknown' | 'due' | 'not_due';

const isCurrentVersionFinished = (
	items: Pick<ITutorialProgressItem, 'tourId' | 'tourVersion' | 'status'>[],
	tour: TourDefinition
): boolean =>
	items.some(
		(item) =>
			item.tourId === tour.id &&
			item.tourVersion === tour.version &&
			(item.status === 'completed' || item.status === 'skipped')
	);

/**
 * Frontend tour host. Renders whichever tour the Help → Tours list requested;
 * without a request, it auto-starts the consultant walkthrough only while the
 * counsellor's own switch is on and the current tour version is neither
 * completed nor skipped (#1526).
 */
export const Walkthrough = () => {
	const settings = useAppConfig();
	const { userData } = useContext(UserDataContext);
	const [launchRequest, setLaunchRequest] = useAtom(tourLaunchRequestAtom);
	const [autoRunState, setAutoRunState] = useState<AutoRunState>('unknown');

	const requestedTour = launchRequest
		? frontendTours.find((tour) => tour.id === launchRequest.tourId)
		: undefined;
	// Auto-run only when nothing was requested at all: a stale or unknown
	// request must not fall back to starting an unrelated tour.
	const wantsAutoRun =
		!!settings.enableWalkthrough &&
		!launchRequest &&
		!!userData.isWalkThroughEnabled;

	useEffect(() => {
		if (!wantsAutoRun || autoRunState !== 'unknown') {
			return;
		}
		let cancelled = false;
		versionedTourProgressRepository
			.getProgress()
			.then((items) => {
				if (!cancelled) {
					setAutoRunState(
						isCurrentVersionFinished(
							items ?? [],
							consultantWalkthroughTour
						)
							? 'not_due'
							: 'due'
					);
				}
			})
			// Unknown progress must not re-open a tour the user already
			// finished; the list still starts it by hand.
			.catch(() => !cancelled && setAutoRunState('not_due'));
		return () => {
			cancelled = true;
		};
	}, [wantsAutoRun, autoRunState]);

	const isAutoRun = wantsAutoRun && autoRunState === 'due';
	const activeTour =
		requestedTour ?? (isAutoRun ? consultantWalkthroughTour : undefined);

	const lastStepId = activeTour
		? activeTour.steps[activeTour.steps.length - 1].id
		: undefined;

	const persistStepProgress = useCallback(
		(event: TourEvent, step?: TourStep) => {
			if (!activeTour) {
				return;
			}
			if (event === 'step_completed' && step && step.id !== lastStepId) {
				// Fire-and-forget: step progress powers the carousel's
				// continue state but must never block the tour.
				versionedTourProgressRepository
					.saveProgress({
						tourId: activeTour.id,
						tourVersion: activeTour.version,
						status: 'in_progress',
						currentStepId: step.id
					})
					.catch(() => {});
			}
			if (event === 'tour_started' && launchRequest?.mode === 'restart') {
				// A restart of a terminal tour re-opens the versioned scope.
				versionedTourProgressRepository
					.saveProgress({
						tourId: activeTour.id,
						tourVersion: activeTour.version,
						status: 'in_progress'
					})
					.catch(() => {});
			}
		},
		[activeTour, lastStepId, launchRequest?.mode]
	);

	const handleTerminalStatus = useCallback(
		async (progress: TourProgress) => {
			try {
				await versionedTourProgressRepository.saveProgress(progress);
			} finally {
				if (progress.tourId === consultantWalkthroughTour.id) {
					setAutoRunState('not_due');
				}
				setLaunchRequest(null);
			}
		},
		[setLaunchRequest]
	);

	if (!settings.enableWalkthrough || !activeTour) {
		return null;
	}

	return (
		<ProductTourAdapter
			key={`${activeTour.id}-${launchRequest?.requestedAt ?? 'auto'}`}
			tour={activeTour}
			active={true}
			paused={!!userData.twoFactorAuth?.isShown}
			tooltipComponent={ProductTourTooltip}
			onEvent={persistStepProgress}
			onTerminalStatus={handleTerminalStatus}
		/>
	);
};
