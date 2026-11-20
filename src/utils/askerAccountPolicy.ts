import type { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';

/** Account collection permission; conversation notification channels are separate. */
export const isAskerEmailCollectionAllowed = (
	settings?: Pick<
		TenantDataSettingsInterface,
		'featureAskerEmailEnabled'
	> | null
): boolean => settings?.featureAskerEmailEnabled !== false;

export type SeekerConversationType = Exclude<
	UserService.Schemas.ConversationType,
	'INTERNAL_GROUP'
>;

const nameKeys = {
	AGENCY_COUNSELLING: 'featureDisplayNameEditableAgencyCounsellingEnabled',
	LIVE_CHAT: 'featureDisplayNameEditableLiveChatEnabled',
	SELF_HELP: 'featureDisplayNameEditableSelfHelpEnabled'
} as const;

/** Generated names remain available when arbitrary name entry is off. */
export const isAskerDisplayNameTypingAllowed = (
	settings: Partial<TenantDataSettingsInterface> | null | undefined,
	context: string | null | undefined
): boolean => {
	if (
		!settings ||
		settings.featureDisplayNameEditable === false ||
		(context !== 'AGENCY_COUNSELLING' &&
			context !== 'LIVE_CHAT' &&
			context !== 'SELF_HELP')
	)
		return false;
	return settings[nameKeys[context]] !== false;
};

const collectionKeys = {
	AGENCY_COUNSELLING: 'featureAskerEmailCollectionAgencyCounsellingEnabled',
	SELF_HELP: 'featureAskerEmailCollectionSelfHelpEnabled'
} as const;
type EmailCollectionSettings = Partial<
	Pick<
		TenantDataSettingsInterface,
		| 'featureAskerEmailEnabled'
		| (typeof collectionKeys)[keyof typeof collectionKeys]
	>
>;

export const isContextEmailCollectionAllowed = (
	settings: EmailCollectionSettings | null | undefined,
	context: unknown
): boolean => {
	if (context !== 'AGENCY_COUNSELLING' && context !== 'SELF_HELP')
		return false;
	return (
		isAskerEmailCollectionAllowed(settings) &&
		settings?.[collectionKeys[context]] !== false
	);
};

export const hasRestrictedEmailCollection = (
	settings?: EmailCollectionSettings | null
): boolean =>
	Object.values(collectionKeys).some((key) => settings?.[key] === false);
