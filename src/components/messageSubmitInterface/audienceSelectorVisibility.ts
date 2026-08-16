export type ComposerChatType =
	| 'anonymous'
	| 'oneOnOne'
	| 'group'
	| 'supervision';

export const shouldShowAudienceSelector = ({
	chatType,
	isClientUser,
	targetCount,
	hasAllOption
}: {
	chatType: ComposerChatType;
	isClientUser: boolean;
	targetCount: number;
	hasAllOption: boolean;
}): boolean => {
	if (isClientUser || chatType === 'oneOnOne' || chatType === 'anonymous') {
		return false;
	}
	return targetCount > 1 && hasAllOption;
};

export const getExplicitAudienceValues = ({
	selectedValues,
	...visibility
}: Parameters<typeof shouldShowAudienceSelector>[0] & {
	selectedValues: string[];
}): string[] => {
	if (!shouldShowAudienceSelector(visibility)) {
		return [];
	}
	return selectedValues.filter((value) => value !== '__all__');
};
