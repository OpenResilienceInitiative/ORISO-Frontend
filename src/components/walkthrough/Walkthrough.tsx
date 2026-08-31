import * as React from 'react';
import { useCallback, useContext } from 'react';
import { useAtom } from 'jotai';
import { UserDataContext } from '../../globalState';
import { useAppConfig } from '../../hooks/useAppConfig';
import { apiPatchConsultantData } from '../../api';
import { ProductTourAdapter } from '../productTour/ProductTourAdapter';
import { ProductTourTooltip } from '../productTour/ProductTourTooltip';
import {
	consultantWalkthroughTour,
	frontendTours
} from '../productTour/tourDefinitions';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { versionedTourProgressRepository } from '../productTour/versionedTourProgressRepository';
import type { TourEvent, TourProgress, TourStep } from '../productTour/types';

/**
 * Frontend tour host. Renders whichever registered tour the profile carousel
 * requested; without a request, the legacy auto-start gate (app-config flag +
 * the user's walkthrough switch) still runs the consultant walkthrough.
 * Progress is persisted through the versioned UserService API; the legacy
 * boolean is kept in sync for the walkthrough tour only, so the auto-start
 * behavior stays unchanged.
 */
export const Walkthrough = () => {
	const settings = useAppConfig();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const [launchRequest, setLaunchRequest] = useAtom(tourLaunchRequestAtom);

	const requestedTour = launchRequest
		? frontendTours.find((tour) => tour.id === launchRequest.tourId)
		: undefined;
	// Auto-run only when nothing was requested at all: a stale or unknown
	// request must not fall back to starting an unrelated tour.
	const isAutoRun = !launchRequest && !!userData.isWalkThroughEnabled;
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
				if (
					activeTour?.id === consultantWalkthroughTour.id &&
					userData.isWalkThroughEnabled
				) {
					// Keep the legacy auto-start boolean in sync so the tour
					// does not re-open on the next app view.
					await apiPatchConsultantData({
						walkThroughEnabled: false
					}).catch(() => {});
					reloadUserData();
				}
				setLaunchRequest(null);
			}
		},
		[
			activeTour?.id,
			reloadUserData,
			setLaunchRequest,
			userData.isWalkThroughEnabled
		]
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
