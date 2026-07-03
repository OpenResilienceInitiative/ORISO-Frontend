import * as React from 'react';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { Switch } from '../Switch';
import { useContext } from 'react';
import { UserDataContext } from '../../globalState';

import { apiPatchConsultantData } from '../../api';
import { useTranslation } from 'react-i18next';

export const EnableWalkthrough = () => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { isWalkThroughEnabled } = userData;
	return (
		<div className="twoFactorAuth">
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
					onChange={() => {
						apiPatchConsultantData({
							walkThroughEnabled: !isWalkThroughEnabled
						})
							.then(reloadUserData)
							.catch((error) => {
								/* console.log(error); */
							});
					}}
					checked={userData.isWalkThroughEnabled}
					aria-label={
						isWalkThroughEnabled
							? translate('walkthrough.switch.active.label')
							: translate('walkthrough.switch.deactive.label')
					}
				/>
				<Text
					text={
						isWalkThroughEnabled
							? translate('walkthrough.switch.active.label')
							: translate('walkthrough.switch.deactive.label')
					}
					type="standard"
				/>
			</div>
		</div>
	);
};
