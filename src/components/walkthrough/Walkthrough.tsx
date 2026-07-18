import * as React from 'react';
import { useCallback, useContext } from 'react';
import { UserDataContext } from '../../globalState';
import { useAppConfig } from '../../hooks/useAppConfig';
import { ProductTourAdapter } from '../productTour/ProductTourAdapter';
import { ProductTourTooltip } from '../productTour/ProductTourTooltip';
import { consultantWalkthroughTour } from '../productTour/tourDefinitions';
import { legacyWalkthroughProgressRepository } from '../productTour/tourProgressRepository';
import type { TourProgress } from '../productTour/types';

/**
 * Consultant walkthrough, rendered through the React Joyride product-tour
 * adapter. Gated by the app config flag and the user's walkthrough setting;
 * paused while the two-factor-authentication dialog is shown.
 */
export const Walkthrough = () => {
	const settings = useAppConfig();
	const { userData, reloadUserData } = useContext(UserDataContext);

	const handleTerminalStatus = useCallback(
		async (progress: TourProgress) => {
			await legacyWalkthroughProgressRepository.saveProgress(progress);
			reloadUserData();
		},
		[reloadUserData]
	);

	if (!userData.isWalkThroughEnabled || !settings.enableWalkthrough) {
		return null;
	}

	return (
		<ProductTourAdapter
			tour={consultantWalkthroughTour}
			active={true}
			paused={!!userData.twoFactorAuth?.isShown}
			tooltipComponent={ProductTourTooltip}
			onTerminalStatus={handleTerminalStatus}
		/>
	);
};
