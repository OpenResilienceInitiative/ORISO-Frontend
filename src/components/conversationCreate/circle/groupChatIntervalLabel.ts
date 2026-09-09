import { GroupChatInterval } from '../../groupChat/createChatHelpers';

export const groupChatIntervalLabelKey = (interval: GroupChatInterval) =>
	`groupChat.create.interval.options.${interval.toLowerCase()}`;
