export type SessionToolbarChipFilter =
	| 'unread'
	| 'drafts'
	| 'nearby'
	| 'liveChat'
	| 'internalGroup'
	| 'groups'
	| 'supervision';

export type SessionToolbarGroupSession = {
	isGroup?: boolean;
	item?: {
		repetitive?: boolean;
	} | null;
};

export const normalizeSessionToolbarChip = (
	chip?: string | null
): SessionToolbarChipFilter | null => {
	switch (chip) {
		case 'neu':
		case 'unread':
			return 'unread';
		case 'oneToOne':
		case 'chats':
		case 'nearby':
			return 'nearby';
		case 'drafts':
			return 'drafts';
		case 'liveChat':
			return 'liveChat';
		case 'internal':
		case 'internalGroup':
			return 'internalGroup';
		case 'circles':
			return 'groups';
		case 'groups':
		case 'supervision':
			return chip;
		default:
			return null;
	}
};

// Group chat filters must rely on room metadata, never encrypted message bodies.
export const isConversationCircleSession = (
	session: SessionToolbarGroupSession
): boolean => Boolean(session.isGroup && session.item?.repetitive);

export const isInternalGroupChatSession = (
	session: SessionToolbarGroupSession
): boolean =>
	Boolean(session.isGroup && !isConversationCircleSession(session));
