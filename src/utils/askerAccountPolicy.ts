import type { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';

/** Account collection permission; conversation notification channels are separate. */
export const isAskerEmailCollectionAllowed = (
	settings?: Pick<
		TenantDataSettingsInterface,
		'featureAskerEmailEnabled'
	> | null
): boolean => settings?.featureAskerEmailEnabled !== false;

/** Generated choices remain available even when arbitrary name entry is off. */
export const isAskerDisplayNameTypingAllowed = (
	settings?: Pick<
		TenantDataSettingsInterface,
		'featureDisplayNameEditable'
	> | null
): boolean => settings?.featureDisplayNameEditable !== false;
