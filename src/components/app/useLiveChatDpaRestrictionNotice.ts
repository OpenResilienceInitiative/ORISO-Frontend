import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_WARNING,
	NotificationDefaultType,
	NotificationsContext
} from '../../globalState/provider/NotificationsProvider';
import { apiGetNewCounsellingAllowed } from '../../api/apiSetLiveChatAvailability';

const NOTICE_ID = 'liveChatNewCounsellingRestricted';

/**
 * A live consultant whose provider has not confirmed the current data
 * processing agreement looks available while advice seekers are turned away
 * (#1704). Warns while she is live and the server says so; the notice goes
 * once she is off or the agreement allows new counselling again.
 */
export const useLiveChatDpaRestrictionNotice = (live: boolean): void => {
	const { t: translate } = useTranslation();
	// Null outside the provider (Storybook shells render NavigationBar bare).
	const setNotifications = useContext(NotificationsContext)?.setNotifications;
	const [restricted, setRestricted] = useState(false);

	useEffect(() => {
		if (!live) {
			setRestricted(false);
			return;
		}
		let current = true;
		apiGetNewCounsellingAllowed().then((allowed) => {
			if (current) setRestricted(allowed === false);
		});
		return () => {
			current = false;
		};
	}, [live]);

	useEffect(() => {
		const isNotice = (item: NotificationDefaultType) =>
			item.id === NOTICE_ID;
		if (!restricted) {
			setNotifications?.((list: NotificationDefaultType[]) =>
				list.some(isNotice)
					? list.filter((item) => !isNotice(item))
					: list
			);
			return;
		}
		const notice: NotificationDefaultType = {
			id: NOTICE_ID,
			notificationType: NOTIFICATION_TYPE_WARNING,
			closeable: true,
			title: translate('profile.functions.liveChat.dpaRestricted.title'),
			text: translate('profile.functions.liveChat.dpaRestricted.text')
		};
		setNotifications?.((list: NotificationDefaultType[]) =>
			list.some(isNotice)
				? list.map((item) => (isNotice(item) ? notice : item))
				: [...list, notice]
		);
	}, [restricted, translate, setNotifications]);
};
