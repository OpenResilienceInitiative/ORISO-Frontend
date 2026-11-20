import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { CheckAnimation } from '../animatedIllustration/AnimatedIllustration';
import { BUTTON_TYPES } from '../button/Button';
import { Overlay, OVERLAY_FUNCTIONS } from '../overlay/Overlay';

export const PasswordChangeConfirmation = () => {
	const { t } = useTranslation();
	const settings = useAppConfig();
	return (
		<Overlay
			item={{
				svg: CheckAnimation,
				headline: t(
					'profile.functions.password.reset.overlay.headline'
				),
				buttonSet: [
					{
						label: t(
							'profile.functions.password.reset.overlay.button.label'
						),
						function: OVERLAY_FUNCTIONS.CLOSE,
						type: BUTTON_TYPES.AUTO_CLOSE
					}
				]
			}}
			handleOverlay={() => {
				window.location.href = settings.urls.toLogin;
			}}
		/>
	);
};
