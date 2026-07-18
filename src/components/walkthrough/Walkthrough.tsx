import * as React from 'react';
import { useCallback, useContext } from 'react';
import { useAtom } from 'jotai';
import { UserDataContext } from '../../globalState';
import { useAppConfig } from '../../hooks/useAppConfig';
import { apiPatchConsultantData } from '../../api';
import { ProductTourAdapter } from '../productTour/ProductTourAdapter';
import { ProductTourTooltip } from '../productTour/ProductTourTooltip';
import { consultantWalkthroughTour } from '../productTour/tourDefinitions';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { versionedTourProgressRepository } from '../productTour/versionedTourProgressRepository';
import type { TourEvent, TourProgress, TourStep } from '../productTour/types';

/**
 * Consultant walkthrough host. Runs either through the legacy auto-start
 * gate (app-config flag + the user's walkthrough switch) or on demand from
 * the profile tutorial carousel. Progress is persisted through the versioned
 * UserService API; the legacy boolean is kept in sync so the auto-start
 * behavior stays unchanged.
 */
export const Walkthrough = () => {
	const settings = useAppConfig();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const [launchRequest, setLaunchRequest] = useAtom(tourLaunchRequestAtom);

	const isLaunchRequested =
		launchRequest?.tourId === consultantWalkthroughTour.id;
	const isAutoRun = !!userData.isWalkThroughEnabled;

	const lastStepId =
		consultantWalkthroughTour.steps[
			consultantWalkthroughTour.steps.length - 1
		].id;

	const persistStepProgress = useCallback(
		(event: TourEvent, step?: TourStep) => {
			if (event === 'step_completed' && step && step.id !== lastStepId) {
				// Fire-and-forget: step progress powers the carousel's
				// continue state but must never block the tour.
				versionedTourProgressRepository
					.saveProgress({
						tourId: consultantWalkthroughTour.id,
						tourVersion: consultantWalkthroughTour.version,
						status: 'in_progress',
						currentStepId: step.id
					})
					.catch(() => {});
			}
			if (event === 'tour_started' && launchRequest?.mode === 'restart') {
				// A restart of a terminal tour re-opens the versioned scope.
				versionedTourProgressRepository
					.saveProgress({
						tourId: consultantWalkthroughTour.id,
						tourVersion: consultantWalkthroughTour.version,
						status: 'in_progress'
					})
					.catch(() => {});
			}
		},
		[lastStepId, launchRequest?.mode]
	);

	const handleTerminalStatus = useCallback(
		async (progress: TourProgress) => {
			try {
				await versionedTourProgressRepository.saveProgress(progress);
			} finally {
				if (userData.isWalkThroughEnabled) {
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
		[reloadUserData, setLaunchRequest, userData.isWalkThroughEnabled]
	);

	if (!settings.enableWalkthrough || (!isAutoRun && !isLaunchRequested)) {
		return null;
	}

	return (
		<ProductTourAdapter
			key={launchRequest?.requestedAt ?? 'auto'}
			tour={consultantWalkthroughTour}
			active={true}
			paused={!!userData.twoFactorAuth?.isShown}
			tooltipComponent={ProductTourTooltip}
			onEvent={persistStepProgress}
			onTerminalStatus={handleTerminalStatus}
		/>
	);
};
