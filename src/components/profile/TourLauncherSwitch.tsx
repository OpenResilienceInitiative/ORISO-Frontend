import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../text/Text';
import { Switch } from '../Switch';
import { UserDataContext } from '../../globalState';
import { useTourLauncherVisible } from '../productTour/launcher/tourLauncherPreference';

/**
 * Shows or hides the floating "?" tour launcher for this user in this
 * browser (Frank, 2026-11-18: the button must be able to disappear
 * completely). Every role sees it; the tours themselves stay startable here.
 */
export const TourLauncherSwitch = () => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const [visible, setVisible] = useTourLauncherVisible(userData?.userId);
	const title = translate('walkthrough.launcherSwitch.title');
	// Static keys, so the i18n guard can see every one of them.
	const stateLabel = translate(
		visible
			? 'walkthrough.launcherSwitch.label.on'
			: 'walkthrough.launcherSwitch.label.off'
	);
	const hint = translate(
		visible
			? 'walkthrough.launcherSwitch.hint.on'
			: 'walkthrough.launcherSwitch.hint.off'
	);
	return (
		<div
			className="helpTours__preference"
			data-testid="tour-launcher-switch"
			data-tour-target="help-tour-switch"
		>
			<Text
				text={title}
				type="standard"
				className="helpTours__preferenceTitle"
			/>
			<div className="twoFactorAuth__switch">
				<Switch
					onChange={() => setVisible(!visible)}
					checked={visible}
					aria-label={title}
				/>
				<Text text={stateLabel} type="standard" />
			</div>
			<Text text={hint} type="standard" className="tertiary" />
		</div>
	);
};
