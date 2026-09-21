import { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_WARNING,
	NotificationDefaultType,
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
	// The state setter is stable; add/removeNotification change identity with
	// every notification and would re-run this effect on each of them.
	const setNotifications = notifications?.setNotifications;
	const shownReason = useRef<LiveChatAvailabilityLossReason | null>(null);

	useEffect(() => {
		const reasonChanged = shownReason.current !== lostReason;
		shownReason.current = lostReason;
		const isNotice = (item: NotificationDefaultType) =>
			item.id === NOTICE_ID &&
			item.notificationType === NOTIFICATION_TYPE_WARNING;
		if (!lostReason) {
			if (reasonChanged)
				setNotifications?.((list: NotificationDefaultType[]) =>
					list.filter((item) => !isNotice(item))
				);
			return;
		}
		const notice: NotificationDefaultType = {
			id: NOTICE_ID,
			notificationType: NOTIFICATION_TYPE_WARNING,
			closeable: true,
			title: translate('profile.functions.liveChat.lost.title'),
			text: translate(LIVE_CHAT_AVAILABILITY_LOSS_TEXT_KEYS[lostReason])
		};
		// The provider has no update call and `addNotification` skips an id it
		// already shows, so the notice is replaced in place. A new reason opens
		// it (again); a language switch only rewords one that is still open.
		setNotifications?.((list: NotificationDefaultType[]) => {
			if (list.some(isNotice))
				return list.map((item) => (isNotice(item) ? notice : item));
			return reasonChanged ? [...list, notice] : list;
		});
	}, [lostReason, translate, setNotifications]);
};
