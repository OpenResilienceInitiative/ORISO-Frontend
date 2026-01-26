import * as React from 'react';
import { useContext, useEffect } from 'react';
import { SessionsDataContext, SET_SESSIONS } from '../../globalState';
import { Headline } from '../headline/Headline';
import { Box } from '../box/Box';
import { useTranslation } from 'react-i18next';
import { apiGetAskerSessionList } from '../../api';
import { ListItemInterface } from '../../globalState/interfaces';

export const AskerConsultingTypeData = () => {
	const { t: translate } = useTranslation([
		'common',
		'consultingTypes',
		'agencies'
	]);

	const { sessions, dispatch } = useContext(SessionsDataContext);

	useEffect(() => {
		apiGetAskerSessionList().then((sessionsData) => {
			dispatch({
				type: SET_SESSIONS,
				ready: true,
				sessions: sessionsData.sessions
			});
		});
	}, [dispatch]);

	return (
		<>
			{Object.values(sessions).map((item: ListItemInterface, index) => (
				<Box key={index}>
					<div className="profile__data__itemWrapper" key={index}>
						<div className="profile__content__title">
							<Headline
								className="pr--3"
								text={item.session.topic.name}
								semanticLevel="5"
							/>
						</div>
						<div className="profile__data__item">
							<p className="profile__data__label">
								{translate('profile.data.agency.label')}
							</p>
							<p className="profile__data__content">
								{item.agency.name}
								<br />
								{item.agency.postcode} {item.agency.city}
							</p>
						</div>
					</div>
				</Box>
			))}
		</>
	);
};
