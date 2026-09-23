import * as React from 'react';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { Switch } from '../Switch';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	UserDataContext
} from '../../globalState';
import { apiPatchConsultantData } from '../../api';

/**
 * The counsellor's own auto-start switch for product tours (#1526). Off only
 * stops tours from starting on their own; the tour list next to it still
 * starts every tour by hand.
 */
export const EnableWalkthrough = () => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const [pending, setPending] = useState(false);
	const isWalkThroughEnabled = !!userData.isWalkThroughEnabled;
	const switchLabel = translate(
		isWalkThroughEnabled
			? 'walkthrough.switch.active.label'
			: 'walkthrough.switch.deactive.label'
	);

	const handleChange = useCallback(() => {
		setPending(true);
		apiPatchConsultantData({ walkThroughEnabled: !isWalkThroughEnabled })
			.then(reloadUserData)
			.catch(() => {
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: translate('profile.notifications.error.title'),
					text: translate('profile.notifications.error.description'),
					closeable: true,
					timeout: 60000
				});
			})
			.finally(() => setPending(false));
	}, [addNotification, isWalkThroughEnabled, reloadUserData, translate]);

	return (
		<div className="twoFactorAuth" data-testid="enable-walkthrough">
			<div className="profile__content__title">
				<Headline
					text={translate('walkthrough.title')}
					semanticLevel="5"
				/>
				<Text
					text={translate('walkthrough.subtitle')}
					type="standard"
					className="tertiary"
				/>
			</div>
			<div className="twoFactorAuth__switch">
				<Switch
					onChange={handleChange}
					checked={isWalkThroughEnabled}
					disabled={pending}
					aria-label={switchLabel}
				/>
				<Text text={switchLabel} type="standard" />
			</div>
			<Text
				text={translate('walkthrough.switch.hint')}
				type="standard"
				className="tertiary"
			/>
		</div>
	);
};
