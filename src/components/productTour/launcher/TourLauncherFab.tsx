import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserDataContext, useTenant } from '../../../globalState';
import { useAppConfig } from '../../../hooks/useAppConfig';
import {
	useFloatingSurfaces,
	useRegisterFloatingSurface
} from '../../floatingSurfaces/floatingSurfaces';
import {
	audienceForUser,
	getAvailableTours,
	isConversationOpenPath,
	orderToursForPage
} from '../tourCatalogue';
import { frontendTours } from '../tourDefinitions';
import { activeTourIdAtom, tourLaunchRequestAtom } from '../tourLaunchState';
import { versionedTourProgressRepository } from '../versionedTourProgressRepository';
import type { TourStartMode } from '../TourOverviewCarousel';
import type { TourDefinition } from '../types';
import {
	TourLauncherMenu,
	type TourLauncherProgress
} from './TourLauncherMenu';
import { useTourLauncherVisible } from './tourLauncherPreference';
import { useTourLauncherPosition } from './tourLauncherPosition';

export const HELP_TOURS_PATH = '/profile/hilfe/rundgaenge';

export interface TourLauncherVisibilityInput {
	walkthroughEnabled: boolean;
	userWantsLauncher: boolean;
	tourCount: number;
	tourRunning: boolean;
	conversationOpen: boolean;
	/** Other floating surfaces on screen (channel switcher, call, ...). */
	otherSurfaces: number;
}

/**
 * When the "?" shows (Frank, 2026-11-18): tours are on for the platform, the
 * user did not switch the button off, there is something to start, no tour
 * is already running, no conversation is open and nothing else floats in
 * the corner — two floating buttons never lie on top of each other.
 */
export const shouldShowTourLauncher = (
	input: TourLauncherVisibilityInput
): boolean =>
	input.walkthroughEnabled &&
	input.userWantsLauncher &&
	input.tourCount > 0 &&
	!input.tourRunning &&
	!input.conversationOpen &&
	input.otherSurfaces === 0;

export const TourLauncherFab = () => {
	const settings = useAppConfig();
	const { userData } = useContext(UserDataContext);
	const tenantSettings = useTenant()?.settings;
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const activeTourId = useAtomValue(activeTourIdAtom);
	const requestTourLaunch = useSetAtom(tourLaunchRequestAtom);
	const [userWantsLauncher, setUserWantsLauncher] = useTourLauncherVisible(
		userData?.userId
	);
	const [position, setPosition] = useTourLauncherPosition(userData?.userId);
	const otherSurfaces = useFloatingSurfaces().filter(
		(id) => id !== 'tour-launcher'
	).length;
	const [progress, setProgress] = useState<TourLauncherProgress[]>([]);

	const audience = audienceForUser(userData);
	const tours = useMemo(
		() =>
			getAvailableTours(frontendTours, audience, {
				flags: { ...tenantSettings },
				userData
			}),
		[audience, tenantSettings, userData]
	);

	const shown = shouldShowTourLauncher({
		walkthroughEnabled: !!settings.enableWalkthrough,
		userWantsLauncher,
		tourCount: tours.length,
		tourRunning: !!activeTourId,
		conversationOpen: isConversationOpenPath(pathname),
		otherSurfaces
	});
	useRegisterFloatingSurface('tour-launcher', shown);

	const refreshProgress = useCallback(() => {
		versionedTourProgressRepository
			.getProgress()
			.then((items) => setProgress(items ?? []))
			// Without progress every tour is offered as not started.
			.catch(() => setProgress([]));
	}, []);

	// Load once the "?" shows, so the card opens with the real status; the
	// card refreshes it again on every open.
	useEffect(() => {
		if (shown) refreshProgress();
	}, [shown, refreshProgress]);

	const startTour = useCallback(
		(tour: TourDefinition, mode: TourStartMode) =>
			requestTourLaunch({
				tourId: tour.id,
				mode,
				requestedAt: Date.now()
			}),
		[requestTourLaunch]
	);

	if (!shown) return null;

	return (
		<TourLauncherMenu
			tours={orderToursForPage(tours, pathname)}
			progress={progress}
			onOpen={refreshProgress}
			onStartTour={startTour}
			onManage={() => navigate(HELP_TOURS_PATH)}
			position={position}
			onMove={setPosition}
			// Shown again under Profil → Hilfe → Rundgänge (the switch).
			onHide={() => setUserWantsLauncher(false)}
		/>
	);
};
