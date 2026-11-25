import * as React from 'react';
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePersonalDisplay } from '../../features/personal-display/PersonalDisplayProvider';
import useTenantTheming from '../../utils/useTenantTheming';
import { Modal } from '../modal/Modal';
import { Spinner } from '../spinner/Spinner';
import {
	setLoginHandoverWaitingForTheme,
	useLoginHandoverActive
} from './loginHandover';

export const TenantThemingLoader = () => {
	const {
		scheme,
		preferences: { textSize, contrast }
	} = usePersonalDisplay();
	const location = useLocation();
	const isLoadingTheme = useTenantTheming({
		scheme,
		textSize,
		contrast,
		location
	});
	// During a sign-in the login handover screen already covers everything;
	// this white modal over it was the white flash between two red frames.
	const isHandingOver = useLoginHandoverActive();
	// The app can be ready before the tenant theme; the handover waits for
	// it so this modal never shows as the screen fades out (#2272). A layout
	// effect, so it is set before the app's ready effect can finish it.
	useLayoutEffect(() => {
		setLoginHandoverWaitingForTheme(isLoadingTheme);
	}, [isLoadingTheme]);
	useLayoutEffect(() => () => setLoginHandoverWaitingForTheme(false), []);

	return isLoadingTheme && !isHandingOver ? (
		<Modal>
			<div>
				<Spinner isDark />
			</div>
		</Modal>
	) : null;
};
