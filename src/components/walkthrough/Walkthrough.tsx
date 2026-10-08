import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { UserDataContext, useTenant } from '../../globalState';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useResponsive } from '../../hooks/useResponsive';
import { canStartPracticeTourInViewport } from '../../practice/practiceViewport';
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
import { canUsePractice } from '../../practice/practiceAccess';
import { isPracticeTourId } from '../../practice/practiceTourIds';
import { isPracticeTourOffered } from '../../practice/practiceTourOffer';
import { practiceTours } from '../../practice/practiceTours';
import { usePracticeTourProgressReporter } from '../../practice/usePracticeTourProgress';

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
	const viewport = useResponsive();
	const { userData } = useContext(UserDataContext);
	const [launchRequest, setLaunchRequest] = useAtom(tourLaunchRequestAtom);
	const [autoRunState, setAutoRunState] = useState<AutoRunState>('unknown');

	const tenantSettings = useTenant()?.settings;
	// A practice tour is hosted only by deliberate request, and only where
	// the practice area is open to this counsellor; the auto-run
	// below stays hard-wired to the intro tour.
	const requestedTour = launchRequest
		? (frontendTours.find((tour) => tour.id === launchRequest.tourId) ??
			(canUsePractice(settings, userData) &&
			canStartPracticeTourInViewport(launchRequest.tourId, viewport)
				? practiceTours.find((tour) => tour.id === launchRequest.tourId)
				: undefined))
		: undefined;
	const unavailablePracticeRequest =
		!!launchRequest &&
		isPracticeTourId(launchRequest.tourId) &&
		(!canUsePractice(settings, userData) ||
			!canStartPracticeTourInViewport(launchRequest.tourId, viewport));
	useEffect(() => {
		if (unavailablePracticeRequest) {
			// Resizing may end an active practice run. Widening the window
			// requires a fresh, deliberate Start instead of replaying its request.
			setLaunchRequest(null);
		}
	}, [unavailablePracticeRequest, setLaunchRequest]);
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
				// A practice tour the Träger switched off (Supervision) has
				// no steps, so nothing starts; no mid-run flip changes that.
				steps:
					isPracticeTourId(activeTour.id) &&
					!isPracticeTourOffered(activeTour, { ...tenantSettings })
						? []
						: resolveTourSteps(activeTour, {
								flags: { ...tenantSettings }
							})
			}
		};
	}
	const runTour = activeTour ? resolvedRunRef.current?.tour : undefined;

	const lastStepId = runTour?.steps[runTour.steps.length - 1]?.id;

	// Feeds the practice banner's "Step i of N"; inert for the ordinary tours.
	const reportPracticeProgress = usePracticeTourProgressReporter(runTour);

	const persistStepProgress = useCallback(
		(event: TourEvent, step?: TourStep) => {
			if (!runTour) {
				return;
			}
			reportPracticeProgress(event, step);
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
		[runTour, lastStepId, launchRequest?.mode, reportPracticeProgress]
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
