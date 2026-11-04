/**
 * Whether the Browser column can promise a pop-up at all (Codex review on
 * FE#1752). `sendNotification` shows none while the routed panel's master
 * switch is off, or while the event's area×kind banner is `off`. Banners are
 * per area and event kind, not per display-filter kind, so the column is
 * gated per section: master off, or every banner of the section's area off.
 * The dialog never flips these; they live in the profile.
 */
import type { DisplayFilterSection } from '../../utils/displayFilter/model';
import type { EventFamily } from '../notificationsCenter/eventDescriptors/types';
import type { OrisoNotificationSettings } from '../../utils/notificationSettings/model';
import {
	AREA_KINDS,
	NotificationArea
} from '../../utils/notificationSettings/notificationConfig';

/** Sections with a Browser column → area, legacy per-type switch, family. */
export const BROWSER_SECTIONS: Partial<
	Record<
		DisplayFilterSection,
		{
			area: NotificationArea;
			legacyType: 'newMessage' | 'initialEnquiry';
			family: EventFamily;
		}
	>
> = {
	sessions: {
		area: 'conversations',
		legacyType: 'newMessage',
		family: 'messages'
	},
	requests: {
		area: 'requests',
		legacyType: 'initialEnquiry',
		family: 'requests'
	}
};

export const browserPopupsOff = (
	section: DisplayFilterSection,
	settings: OrisoNotificationSettings,
	crossDevicePanel: boolean,
	legacyEnabled: boolean
): boolean => {
	const entry = BROWSER_SECTIONS[section];
	if (!entry) return false;
	const masterOn = crossDevicePanel
		? Boolean(settings.browserNotifications?.enabled)
		: legacyEnabled;
	if (!masterOn) return true;
	return AREA_KINDS[entry.area].every(
		(kind) => settings.notificationConfig[entry.area][kind].banner === 'off'
	);
};
