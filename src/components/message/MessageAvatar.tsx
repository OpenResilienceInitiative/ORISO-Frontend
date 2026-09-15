import * as React from 'react';
import { UserAvatar } from './UserAvatar';

export interface MessageAvatarProps {
	/** Kept for API stability; since #1193 groups use the same animal avatar. */
	isGroup: boolean;
	isSystemNotification: boolean;
	userId: string;
	username: string;
	displayName: string;
	firstName?: string;
	lastName?: string;
	size?: number;
}

/**
 * Chat message avatar: the user's animal icon, in 1-on-1 and group chats
 * alike (#1193 Job 4 removed the group-only initials fallback).
 * System notifications render no avatar here (handled in MessageItemComponent).
 */
export const MessageAvatar: React.FC<MessageAvatarProps> = ({
	isSystemNotification,
	userId,
	username,
	displayName,
	firstName,
	lastName,
	size = 32
}) => {
	if (isSystemNotification) {
		return null;
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
