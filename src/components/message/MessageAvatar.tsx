import * as React from 'react';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import { UserAvatar } from './UserAvatar';
import type { AvatarChoice } from '../../utils/avatarChoice';

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
	/** The animal circle's grey outline; see `AnimalAvatar`. */
	outline?: boolean;
	/** The sender's own pick, for the user's own messages (#1240). */
	choice?: AvatarChoice | null;
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
	size = AVATAR_SIZES.message,
	outline = false,
	choice
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
			size={size}
			ring={false}
			outline={outline}
			choice={choice}
		/>
	);
};
