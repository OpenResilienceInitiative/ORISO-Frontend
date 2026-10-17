import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import type { DisplayFilterSection } from '../../utils/displayFilter/model';
import { isBrowserNotificationTypeEnabled } from '../../utils/notificationHelpers';
import { usesNewNotifications } from '../../utils/newNotificationsToggle';
import { BROWSER_SECTIONS, browserPopupsOff } from './browserAvailability';

/** The Browser cells' unavailable reason, or `undefined` when pop-ups can show. */
export const useDisplayFilterBrowserUnavailable = (
	section: DisplayFilterSection
): string | undefined => {
	const { t } = useTranslation();
	const crossDevicePanel = usesNewNotifications(useAppConfig());
	const { settings } = useNotificationSettings();
	const legacyType = BROWSER_SECTIONS[section]?.legacyType;
	const legacyEnabled = legacyType
		? Boolean(isBrowserNotificationTypeEnabled(legacyType))
		: false;
	return browserPopupsOff(section, settings, crossDevicePanel, legacyEnabled)
		? t('notifications.displayFilter.browserOff')
		: undefined;
};
