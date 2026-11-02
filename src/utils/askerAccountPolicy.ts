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

export type SeekerConversationType = Exclude<
	UserService.Schemas.ConversationType,
	'INTERNAL_GROUP'
>;
const collectionKeys = {
	AGENCY_COUNSELLING: 'featureAskerEmailCollectionAgencyCounsellingEnabled',
	LIVE_CHAT: 'featureAskerEmailCollectionLiveChatEnabled',
	SELF_HELP: 'featureAskerEmailCollectionSelfHelpEnabled'
} as const;
type EmailCollectionSettings = Partial<
	Pick<
		TenantDataSettingsInterface,
		| 'featureAskerEmailEnabled'
		| (typeof collectionKeys)[SeekerConversationType]
	>
>;

export const isContextEmailCollectionAllowed = (
	settings: EmailCollectionSettings | null | undefined,
	context: unknown
): boolean => {
	if (
		context !== 'AGENCY_COUNSELLING' &&
		context !== 'LIVE_CHAT' &&
		context !== 'SELF_HELP'
	)
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
