import * as React from 'react';
import { useContext } from 'react';
import { handleNumericTranslation } from '../../utils/translate';
import { getContact, ActiveSessionContext, useTopic } from '../../globalState';
import {
	convertUserDataObjectToArray,
	getUserDataTranslateBase
} from '../profile/profileHelpers';
import { Text } from '../text/Text';
import { useTranslation } from 'react-i18next';
import { TopicSessionInterface } from '../../globalState/interfaces';

export const AskerInfoData = () => {
	const { t: translate } = useTranslation(['common', 'consultingTypes']);
	const { activeSession } = useContext(ActiveSessionContext);

	const topic = useTopic(
		(activeSession.item.topic as TopicSessionInterface).id
	);

	const userSessionData = getContact(activeSession).sessionData;
	const preparedUserSessionData =
		convertUserDataObjectToArray(userSessionData);

	return (
		<>
			<Text text={translate('userProfile.data.title')} type="divider" />
			<div className="askerInfo__data__item">
				<p className="askerInfo__data__label">
					{translate('userProfile.data.resort')}
				</p>
				<p className="askerInfo__data__content">{topic?.name || ''}</p>
			</div>
			{activeSession.item.consultingType === 0 && (
				<div className="askerInfo__data__item">
					<p className="askerInfo__data__label">
						{translate('userProfile.data.postcode')}
					</p>
					<p className="askerInfo__data__content">
						{activeSession.item.postcode}
					</p>
				</div>
			)}
			{preparedUserSessionData.map((item, index) =>
				item.type === 'age' && item.value === 'null' ? null : (
					<div className="askerInfo__data__item" key={index}>
						<p className="askerInfo__data__label">
							{translate('userProfile.data.' + item.type)}
						</p>
						<p
							className={
								item.value
									? `askerInfo__data__content`
									: `askerInfo__data__content askerInfo__data__content--empty`
							}
						>
							{item.value
								? translate(
										handleNumericTranslation(
											getUserDataTranslateBase(
												activeSession.item
													.consultingType
											),
											item.type,
											item.value
										)
									)
								: translate('profile.noContent')}
						</p>
					</div>
				)
			)}
		</>
	);
};
