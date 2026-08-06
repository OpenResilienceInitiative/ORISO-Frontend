import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOpenTwoFactorSettings } from '../../hooks/useOpenTwoFactorSettings';
import { UserDataContext } from '../../globalState';
import { BUTTON_TYPES } from '../button/Button';
import { Overlay, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import './twoFactorNag.styles';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { STORAGE_KEY_2FA, useDevToolbar } from '../devToolbar/DevToolbar';
import { OVERLAY_TWO_FACTOR_NAG } from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';

interface TwoFactorNagProps {}

/**
 * Dismissals live in sessionStorage: the nag may re-appear in a new browser
 * session but must not force-open on every full page load (#841).
 */
export const TWO_FACTOR_NAG_DISMISSED_KEY = 'twoFactorNagDismissed';

export const TwoFactorNag: React.FC<TwoFactorNagProps> = () => {
	const { t: translate } = useTranslation();
	const openTwoFactorSettings = useOpenTwoFactorSettings();
	const location = useLocation();

	const settings = useAppConfig();
	const { userData } = useContext(UserDataContext);
	const { getDevToolbarOption } = useDevToolbar();
	const [isShownTwoFactorNag, setIsShownTwoFactorNag] = useState(false);
	const [forceHideTwoFactorNag, setForceHideTwoFactorNag] = useState(
		() => sessionStorage.getItem(TWO_FACTOR_NAG_DISMISSED_KEY) === 'true'
	);
	const [message, setMessage] = useState({
		title: 'twoFactorAuth.nag.obligatory.moment.title',
		copy: 'twoFactorAuth.nag.obligatory.moment.copy',
		showClose: true
	});

	useEffect(() => {
		let todaysDate = new Date(Date.now());

		if (
			userData.twoFactorAuth?.isEnabled &&
			!userData.twoFactorAuth?.isActive &&
			!location.state?.openTwoFactor &&
			!forceHideTwoFactorNag &&
			todaysDate >= settings.twofactor.startObligatoryHint &&
			getDevToolbarOption(STORAGE_KEY_2FA) === '1'
		) {
			// Obligatory phase: show the nag on top of the requested view
			// instead of redirecting — deep links must keep their navigation
			// target, and a non-closable overlay would block every view
			// underneath it (#841).
			const configuredMessage =
				todaysDate >= settings.twofactor.dateTwoFactorObligatory
					? (settings.twofactor.messages[1] ??
						settings.twofactor.messages[0])
					: settings.twofactor.messages[0];
			setIsShownTwoFactorNag(true);
			setMessage({ ...configuredMessage, showClose: true });
		} else {
			setIsShownTwoFactorNag(false);
		}
	}, [
		userData,
		forceHideTwoFactorNag,
		settings.twofactor.startObligatoryHint,
		settings.twofactor.dateTwoFactorObligatory,
		settings.twofactor.messages,
		getDevToolbarOption,
		location
	]);

	const handleTwoFactorNag = useCallback((val) => {
		setForceHideTwoFactorNag(val);
		if (val) {
			sessionStorage.setItem(TWO_FACTOR_NAG_DISMISSED_KEY, 'true');
		}
	}, []);

	const closeTwoFactorNag = async () => {
		handleTwoFactorNag(true);
		setIsShownTwoFactorNag(false);
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			openTwoFactorSettings();
			handleTwoFactorNag(true);
			setIsShownTwoFactorNag(false);
		}
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			handleTwoFactorNag(true);
			setIsShownTwoFactorNag(false);
		}
	};

	if (!isShownTwoFactorNag) return <></>;

	return (
		<Overlay
			name={OVERLAY_TWO_FACTOR_NAG}
			className="twoFactorNag"
			handleOverlayClose={message.showClose ? closeTwoFactorNag : null}
			handleOverlay={handleOverlayAction}
			item={{
				headline: translate(message.title, {
					date: settings.twofactor.dateTwoFactorObligatory.toLocaleDateString(
						'de-DE'
					)
				}),
				copy: translate(message.copy, {
					date1: settings.twofactor.dateTwoFactorObligatory.toLocaleDateString(
						'de-DE'
					),
					date2: settings.twofactor.dateTwoFactorObligatory.toLocaleDateString(
						'de-DE'
					)
				}),
				buttonSet: message.showClose
					? [
							{
								label: translate(
									'twoFactorAuth.nag.button.later'
								),
								function: OVERLAY_FUNCTIONS.CLOSE,
								type: BUTTON_TYPES.SECONDARY
							},
							{
								label: translate(
									'twoFactorAuth.nag.button.protect'
								),
								function: OVERLAY_FUNCTIONS.REDIRECT,
								type: BUTTON_TYPES.PRIMARY
							}
						]
					: [
							{
								label: translate(
									'twoFactorAuth.nag.button.protect'
								),
								function: OVERLAY_FUNCTIONS.REDIRECT,
								type: BUTTON_TYPES.PRIMARY
							}
						]
			}}
		/>
	);
};
