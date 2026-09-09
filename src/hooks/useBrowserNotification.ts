import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListItemInterface } from '../globalState/interfaces';
import { appConfig } from '../utils/appConfig';
import { sendNotification } from '../utils/notificationHelpers';

export const useBrowserNotification = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const maybeSendNewEnquiryNotification = useCallback(
		(sessions: ListItemInterface[]) => {
			const enquirySessions = sessions.filter((session) => {
				return (
					!session.consultant &&
					session.session?.createDate &&
					new Date().getTime() -
						new Date(session.session.createDate).getTime() <
						1000 * 60
				);
			});

			// Modern delivery belongs to the event provider; this is only the
			// legacy transport. sendNotification still owns the opt-in gate.
			if (
				enquirySessions.length > 0 &&
				!appConfig?.releaseToggles?.enableNewNotifications
			) {
				sendNotification(t('notifications.initialRequest.new'), {
					// A new enquiry belongs to Anfrage → Neue Anfrage, not to
					// the conversations fallback row (#586 audit).
					family: 'requests',
					eventType: 'request.new',
					showAlways: true,
					onclick: () => {
						navigate(`/sessions/consultant/sessionPreview`);
					}
				});
			}
		},
		[navigate, t]
	);

	return {
		maybeSendNewEnquiryNotification
	};
};
