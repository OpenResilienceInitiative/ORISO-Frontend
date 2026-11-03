import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import type { DisplayFilterSection } from '../../utils/displayFilter/model';
import {
	hasPermissions,
	isBrowserNotificationTypeEnabled,
	isSupported
} from '../../utils/notificationHelpers';
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

/**
 * A notice, not a lock: while this browser cannot show pop-ups (no
 * Notification API, permission denied) or delivery's own gate
 * (`isSuppressed`: do not disturb, account mute, this device silenced)
 * holds them back, the cells stay editable. The column edits preferences
 * synced to every device; this device's state is often temporary.
 * `default` adds nothing: the app asks on the first gesture.
 */
export const useDisplayFilterBrowserMuted = (
	section: DisplayFilterSection
): string | undefined => {
	const { t } = useTranslation();
	const { isSuppressed } = useNotificationSettings();
	const family = BROWSER_SECTIONS[section]?.family;
	if (!family) return undefined;
	if (!isSupported())
		return t('erstantwort.notificationChoice.browserUnsupported');
	if (hasPermissions('denied'))
		return t('erstantwort.notificationChoice.browserDenied');
	return isSuppressed(family)
		? t('erstantwort.notificationChoice.browserSilenced')
		: undefined;
};
