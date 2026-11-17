import React, { useCallback } from 'react';
import { useUpcomingAppointments } from '../../../../containers/overview/hooks/useUpcomingAppointments';
import { useConsultantData } from '../../../../containers/overview/hooks/useConsultantData';
import { LinkMenu } from '../../../mobile/linkMenu/LinkMenu';
import { SESSION_LIST_TYPES } from '../../../session/sessionHelpers';
import { useTranslation } from 'react-i18next';

export const OverviewSessions = () => {
	const { t: translate } = useTranslation();

	const { total: totalEnquiry } = useConsultantData({
		type: SESSION_LIST_TYPES.ENQUIRY
	});
	const { total: totalMySessions } = useConsultantData({
		type: SESSION_LIST_TYPES.MY_SESSION
	});
	const { appointments } = useUpcomingAppointments();

	const getCount = useCallback((count) => (count > 9 ? '9+' : count), []);

	const items = [
		{
			title: translate('overview.myMessagesTitle', {
				countStr: getCount(totalMySessions)
			}),
			url: '/sessions/consultant/sessionPreview'
		},
		{
			title: translate('overview.initialInquiriesTitle', {
				countStr: getCount(totalEnquiry)
			}),
			url: '/sessions/consultant/sessionView'
		},
		{
			title: `${translate('overview.upcomingAppointments', {
				countStr: getCount(appointments.length)
			})}`,
			url: '/booking/events'
		}
	];
	return <LinkMenu items={items} />;
};
