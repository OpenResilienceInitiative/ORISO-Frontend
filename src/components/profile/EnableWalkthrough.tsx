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
 * The counsellor's personal introduction auto-start preference (#1526).
 * Manual learning actions remain available while it is off.
 */
export const EnableWalkthrough = ({
	embedded = false
}: {
	embedded?: boolean;
}) => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const [pending, setPending] = useState(false);
	const isWalkThroughEnabled = !!userData.isWalkThroughEnabled;
	const title = translate('walkthrough.switch.title');
	// Static keys, so the i18n guard can see every one of them.
	const stateLabel = translate(
		isWalkThroughEnabled
			? 'walkthrough.switch.label.on'
			: 'walkthrough.switch.label.off'
	);
	const hint = translate(
		isWalkThroughEnabled
			? 'walkthrough.switch.hint.on'
			: 'walkthrough.switch.hint.off'
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
		<div
			className={embedded ? 'helpTours__preference' : 'twoFactorAuth'}
			data-testid="enable-walkthrough"
		>
			{embedded ? (
				<Text
					text={title}
					type="standard"
					className="helpTours__preferenceTitle"
				/>
			) : (
				<div className="profile__content__title">
					<Headline text={title} semanticLevel="5" />
					<Text
						text={translate('walkthrough.switch.subtitle')}
						type="standard"
						className="tertiary"
					/>
				</div>
			)}
			<div className="twoFactorAuth__switch">
				<Switch
					onChange={handleChange}
					checked={isWalkThroughEnabled}
					disabled={pending}
					aria-label={title}
				/>
				<Text text={stateLabel} type="standard" />
			</div>
			<Text text={hint} type="standard" className="tertiary" />
		</div>
	);
};
