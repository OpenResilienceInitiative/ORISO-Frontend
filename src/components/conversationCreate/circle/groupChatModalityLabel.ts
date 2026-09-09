import { GroupChatModality } from '../../groupChat/createChatHelpers';

export const groupChatModalityLabelKey = (modality: GroupChatModality) =>
	`groupChat.create.modality.options.${modality.toLowerCase()}`;
