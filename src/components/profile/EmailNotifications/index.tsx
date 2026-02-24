import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../../globalState';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { EmailToggle } from './EmailToggle';
import { NoEmailSet } from './NoEmailSet';

export const EmailNotification = () => {
	const { userData } = React.useContext(UserDataContext);
	const { t } = useTranslation();

	return (
		<div className="notifications__content notifications__content--enhanced">
			<div className="profile__content__title notifications__hero">
				<Headline
					text={t('profile.notifications.title')}
					semanticLevel="5"
				/>
				<Text
					text={t('profile.notifications.description')}
					type="standard"
					className="tertiary"
				/>
			</div>
			{!userData.email && (
				<div className="notifications__panel">
					<NoEmailSet />
				</div>
			)}
			{userData.email && (
				<div className="notifications__panel">
					<EmailToggle
						name="emailNotificationsEnabled"
						titleKey="profile.notifications.mainEmail.title"
					/>
				</div>
			)}
		</div>
	);
};
