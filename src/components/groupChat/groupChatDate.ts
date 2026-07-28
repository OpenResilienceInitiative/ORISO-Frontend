interface GroupChatStartFields {
	startDateWithTime?: string;
	startDate?: string;
	startTime?: string;
}

export const getGroupChatPlannedStart = (
	item: GroupChatStartFields
): Date | null => {
	const raw =
		item.startDateWithTime ||
		(item.startDate && item.startTime
			? `${item.startDate}T${item.startTime}`
			: '');
	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};
