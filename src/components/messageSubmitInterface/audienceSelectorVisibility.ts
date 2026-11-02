export type ComposerChatType =
	| 'anonymous'
	| 'oneOnOne'
	| 'group'
	| 'supervision';

/**
 * A counsellor's composer in a group session (the group chat itself or its
 * supervision panel) keeps a restricted audience through a partial roster.
 * There the picker stays visible while it is restricted, so an unresolved
 * choice can block a send without trapping the draft. Asker, 1:1 and
 * anonymous composers never send VISIBLE_TO and drop stale recipients.
 */
export const retainsGroupAudienceSelection = ({
	chatType,
	isClientUser,
	isGroupSession = chatType === 'group'
}: {
	chatType: ComposerChatType;
	isClientUser: boolean;
	isGroupSession?: boolean;
}): boolean =>
	!isClientUser &&
	(chatType === 'group' || (chatType === 'supervision' && isGroupSession));

export const shouldShowAudienceSelector = ({
	chatType,
	isClientUser,
	targetCount,
	hasAllOption,
	selectedValues = [],
	isGroupSession
}: {
	chatType: ComposerChatType;
	isClientUser: boolean;
	targetCount: number;
	hasAllOption: boolean;
	selectedValues?: string[];
	isGroupSession?: boolean;
}): boolean => {
	if (isClientUser || chatType === 'oneOnOne' || chatType === 'anonymous') {
		return false;
	}
	// A temporary partial roster must not hide an existing privacy choice or
	// convert it to a public send. Keep the picker available to resolve it.
	const restrictedGroup =
		retainsGroupAudienceSelection({
			chatType,
			isClientUser,
			isGroupSession
		}) && selectedValues.some((value) => value !== '__all__');
	return (targetCount > 1 || restrictedGroup) && hasAllOption;
};

export const getExplicitAudienceValues = ({
	selectedValues,
	...visibility
}: Parameters<typeof shouldShowAudienceSelector>[0] & {
	selectedValues: string[];
}): string[] => {
	if (!shouldShowAudienceSelector({ ...visibility, selectedValues })) {
		return [];
	}
	return selectedValues.filter((value) => value !== '__all__');
};
