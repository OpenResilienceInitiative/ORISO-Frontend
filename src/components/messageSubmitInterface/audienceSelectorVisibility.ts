export type ComposerChatType =
	| 'anonymous'
	| 'oneOnOne'
	| 'group'
	| 'supervision';

export const shouldShowAudienceSelector = ({
	chatType,
	isClientUser,
	targetCount,
	hasAllOption,
	selectedValues = []
}: {
	chatType: ComposerChatType;
	isClientUser: boolean;
	targetCount: number;
	hasAllOption: boolean;
	selectedValues?: string[];
}): boolean => {
	if (isClientUser || chatType === 'oneOnOne' || chatType === 'anonymous') {
		return false;
	}
	// A temporary partial roster must not hide an existing privacy choice or
	// convert it to a public send. Keep the picker available to resolve it.
	const restrictedGroup =
		chatType === 'group' &&
		selectedValues.some((value) => value !== '__all__');
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
