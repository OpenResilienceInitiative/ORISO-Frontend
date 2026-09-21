import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_WARNING,
	NotificationsContext
} from '../../globalState/provider/NotificationsProvider';
import { LiveChatAvailabilityLossReason } from '../../utils/liveChatAvailabilityStorage';

const NOTICE_ID = 'liveChatAvailabilityLost';

export const LIVE_CHAT_AVAILABILITY_LOSS_TEXT_KEYS: Record<
	LiveChatAvailabilityLossReason,
	string
> = {
	refused: 'profile.functions.liveChat.lost.refused',
	sessionExpired: 'profile.functions.liveChat.lost.sessionExpired',
	leaseLost: 'profile.functions.liveChat.lost.leaseLost',
	connectionLost: 'profile.functions.liveChat.lost.connectionLost'
};

/**
 * Tells the consultant that the client switched live chat off on its own and
 * how to get back (#1485). Stays until closed or until she is live again, so
 * a counsellor away from the screen still finds it when she returns.
 */
export const useLiveChatAvailabilityLossNotice = (
	lostReason: LiveChatAvailabilityLossReason | null
): void => {
	const { t: translate } = useTranslation();
	// Null outside the provider (Storybook shells render NavigationBar bare).
	const notifications = useContext(NotificationsContext);

	useEffect(() => {
		if (!lostReason) {
			notifications?.removeNotification(
				NOTICE_ID,
				NOTIFICATION_TYPE_WARNING
			);
			return;
		}
		notifications?.addNotification({
			id: NOTICE_ID,
			notificationType: NOTIFICATION_TYPE_WARNING,
			closeable: true,
			title: translate('profile.functions.liveChat.lost.title'),
			text: translate(LIVE_CHAT_AVAILABILITY_LOSS_TEXT_KEYS[lostReason])
		});
		// Context callbacks change identity with every notification; the
		// notice follows the reason only.
	}, [lostReason]); // eslint-disable-line react-hooks/exhaustive-deps
};
