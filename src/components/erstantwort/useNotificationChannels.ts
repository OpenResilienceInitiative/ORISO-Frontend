import { useContext } from 'react';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { appConfig } from '../../utils/appConfig';
import {
	browserNotificationsSettings,
	isSupported
} from '../../utils/notificationHelpers';

/** Account/device capability shared by automatic invitations and manual setup.
 * An address alone is not an active channel; a silenced browser is not reachable.
 */
export const useNotificationChannels = (
	isEmailEnabled = true,
	isBrowserEnabled = true
) => {
	const { userData } = useContext(UserDataContext);
	const { settings, isSuppressed } = useNotificationSettings();
	const emailActive =
		isEmailEnabled &&
		Boolean(
			userData?.email &&
				userData?.emailNotifications?.emailNotificationsEnabled &&
				userData?.emailNotifications?.settings
					?.newChatMessageNotificationEnabled
		);
	const consentEmailActive =
		isEmailEnabled &&
		Boolean(
			userData?.email &&
				userData?.emailNotifications?.emailNotificationsEnabled &&
				userData?.emailNotifications?.settings
					?.reassignmentNotificationEnabled
		);
	const browserSupported = isBrowserEnabled && Boolean(isSupported());
	const browserActive = Boolean(
		browserSupported &&
			Notification.permission === 'granted' &&
			(appConfig?.releaseToggles?.enableNewNotifications === true
				? settings.browserNotifications?.enabled
				: browserNotificationsSettings().enabled)
	);
	const browserSilenced = isSuppressed('messages');
	return {
		emailActive,
		consentEmailActive,
		browserActive,
		browserSupported,
		browserSilenced,
		hasReachableChannel: emailActive || (browserActive && !browserSilenced)
	};
};
