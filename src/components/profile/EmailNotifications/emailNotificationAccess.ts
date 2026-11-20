import type { AppConfigInterface } from '../../../globalState/interfaces';
import type { TenantDataSettingsInterface } from '../../../globalState/interfaces/TenantDataInterface';
import { usesNewNotifications } from '../../../utils/newNotificationsToggle';
import { notificationChannelPolicy } from '../../erstantwort/notificationChannelPolicy';
import type { NotificationSwitch } from './notificationMatrix';

/**
 * #1979: the settings screen follows the Admin "Berechtigungen".
 *
 * The tenant settings are the effective values TenantService delivers on the
 * public tenant DTO (platform policy first, then the Träger). Counselling
 * centres do not store these switches, so there is no third level to merge.
 * UserService applies the same rules before sending; hiding a switch here is
 * not the guard, it only stops offering what will never be sent.
 */
type TenantSettings = Partial<TenantDataSettingsInterface> | null | undefined;

const ASKER_CONVERSATION_TYPES = [
	'AGENCY_COUNSELLING',
	'LIVE_CHAT',
	'SELF_HELP'
];

/** An advice seeker can get e-mail in at least one conversation type. */
export const askerEmailNotificationsPermitted = (settings: TenantSettings) =>
	ASKER_CONVERSATION_TYPES.some(
		(type) =>
			notificationChannelPolicy(settings ?? undefined, type).emailAllowed
	);

/** Settings shows an advice seeker e-mail switches: release toggle AND permission. */
export const askerHasEmailSettings = (
	config: Pick<AppConfigInterface, 'releaseToggles'> | null | undefined,
	settings: TenantSettings
) => usesNewNotifications(config) && askerEmailNotificationsPermitted(settings);

/**
 * Whether Settings > Notifications has an e-mail panel to link to. Counsellors
 * keep one either way (legacy or new); advice seekers per the rule above.
 */
export const hasEmailSettingsPanel = (
	config: Pick<AppConfigInterface, 'releaseToggles'> | null | undefined,
	settings: TenantSettings,
	isConsultant: boolean
) => isConsultant || askerHasEmailSettings(config, settings);

/** Switches whose mail the Träger has switched off are not offered. */
export const visibleEmailSwitches = (
	switches: NotificationSwitch[],
	settings: TenantSettings
) =>
	settings?.featureConsultantEmailInternalGroupEnabled === false
		? switches.filter((entry) => entry.id !== 'internalChat')
		: switches;
