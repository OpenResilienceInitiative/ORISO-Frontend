import * as React from 'react';
import { useMemo } from 'react';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import { UserAvatar } from './UserAvatar';

export interface MessageAvatarProps {
	isGroup: boolean;
	isUserMessage: boolean;
	isSystemNotification: boolean;
	/** Reserved for future outgoing-specific styling; 1-on-1 uses animal either way. */
	isMyMessage?: boolean;
	userId: string;
	username: string;
	displayName: string;
	firstName?: string;
	lastName?: string;
	size?: number;
}

/**
 * Chat message avatar: animal pseudonym for 1-on-1 messages, initials in groups.
 * System notifications render no avatar here (handled in MessageItemComponent).
 */
export const MessageAvatar: React.FC<MessageAvatarProps> = ({
	isGroup,
	isSystemNotification,
	userId,
	username,
	displayName,
	firstName,
	lastName,
	size = 32
}) => {
	const clientAvatar = useMemo(() => generateAvatarForUser(userId), [userId]);

	if (isSystemNotification) {
		return null;
	}

	if (!isGroup) {
		return <AnimalAvatar avatar={clientAvatar} size={size} />;
	}

	return (
		<UserAvatar
			username={username}
			displayName={displayName}
			firstName={firstName}
			lastName={lastName}
			userId={userId}
			size={`${size}px`}
			ring={false}
		/>
	);
};
