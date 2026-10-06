import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { UserDataContext, useTenant } from '../../globalState';
import { useAppConfig } from '../../hooks/useAppConfig';
import { ProductTourAdapter } from '../productTour/ProductTourAdapter';
import { ProductTourTooltip } from '../productTour/ProductTourTooltip';
import {
	consultantWalkthroughTour,
	frontendTours
} from '../productTour/tourDefinitions';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { resolveTourSteps } from '../productTour/tourEngine';
import { getTourHostHooks } from '../productTour/tourHostHooks';
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
	const switchIsOn =
		!!settings.enableWalkthrough && !!userData.isWalkThroughEnabled;
	const wantsAutoRun = switchIsOn && !launchRequest;

	// Progress can change in another session while the switch is off, so
	// turning it back on must read it again instead of reusing the old verdict.
	useEffect(() => {
		if (!switchIsOn) {
			setAutoRunState('unknown');
		}
	}, [switchIsOn]);

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

	// Variants resolve once per run, so the adapter, its reducer and the
	// last-step check below all count the same steps.
	const tenantSettings = useTenant()?.settings;
	const runKey = `${activeTour?.id}-${launchRequest?.requestedAt ?? 'auto'}`;
	const resolvedRunRef = useRef<{
		key: string;
		tour: TourDefinition;
	} | null>(null);
	if (!activeTour) {
		resolvedRunRef.current = null;
	} else if (resolvedRunRef.current?.key !== runKey) {
		resolvedRunRef.current = {
			key: runKey,
			tour: {
				...activeTour,
				steps: resolveTourSteps(activeTour, {
					flags: { ...tenantSettings }
				})
			}
		};
	}
	const runTour = activeTour ? resolvedRunRef.current?.tour : undefined;

	const lastStepId = runTour?.steps[runTour.steps.length - 1]?.id;

	const persistStepProgress = useCallback(
		(event: TourEvent, step?: TourStep) => {
			if (!runTour) {
				return;
			}
			if (event === 'step_completed' && step && step.id !== lastStepId) {
				// Fire-and-forget: step progress powers the carousel's
				// continue state but must never block the tour.
				versionedTourProgressRepository
					.saveProgress({
						tourId: runTour.id,
						tourVersion: runTour.version,
						status: 'in_progress',
						currentStepId: step.id
					})
					.catch(() => {});
			}
			if (event === 'tour_started' && launchRequest?.mode === 'restart') {
				// A restart of a terminal tour re-opens the versioned scope.
				versionedTourProgressRepository
					.saveProgress({
						tourId: runTour.id,
						tourVersion: runTour.version,
						status: 'in_progress'
					})
					.catch(() => {});
			}
		},
		[runTour, lastStepId, launchRequest?.mode]
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

	if (!settings.enableWalkthrough || !runTour || !runTour.steps.length) {
		return null;
	}

	const hostHooks = getTourHostHooks(runTour.id);

	return (
		<ProductTourAdapter
			key={runKey}
			tour={runTour}
			active={true}
			paused={!!userData.twoFactorAuth?.isShown}
			tooltipComponent={ProductTourTooltip}
			onEvent={persistStepProgress}
			onTerminalStatus={handleTerminalStatus}
			onBeforeStart={hostHooks?.setup}
			onEnd={hostHooks?.teardown}
		/>
	);
};
