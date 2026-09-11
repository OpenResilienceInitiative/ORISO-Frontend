import * as React from 'react';
import { useContext, useEffect } from 'react';
import { SessionsDataContext, SET_SESSIONS } from '../../globalState';
import { useTranslation } from 'react-i18next';
import { apiGetAskerSessionList } from '../../api';
import { ListItemInterface } from '../../globalState/interfaces';
import { AgencyInfoCard } from './AgencyInfoCard';

export const AskerConsultingTypeData = () => {
	useTranslation(['common', 'consultingTypes', 'agencies']);

	const { sessions, dispatch } = useContext(SessionsDataContext);

	useEffect(() => {
		apiGetAskerSessionList()
			.then((sessionsData) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions: sessionsData?.sessions || []
				});
			})
			.catch(() => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions: []
				});
			});
	}, [dispatch]);

	const safeSessionItems = Object.values(sessions || {}).filter(
		(item: ListItemInterface) => !!item
	);

	return (
		<>
			{safeSessionItems.map((item: ListItemInterface, index) => (
				<AgencyInfoCard key={item?.session?.id ?? index} item={item} />
			))}
		</>
	);
};
