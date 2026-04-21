import * as React from 'react';
import { Avatar } from '@vector-im/compound-web';
import {
	formatMessagePersonName,
	getMessagePersonInitials
} from './messageNameUtils';

interface UserAvatarProps {
	username: string;
	displayName?: string;
	firstName?: string;
	lastName?: string;
	userId: string;
	size?: string;
}

/**
 * UserAvatar component using REAL Compound UI
 * This is the actual Element Web avatar component
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
	username,
	displayName,
	firstName,
	lastName,
	userId,
	size = '32px'
}) => {
	const resolvedName = formatMessagePersonName(
		displayName,
		username,
		firstName,
		lastName
	);
	const initials = getMessagePersonInitials(
		displayName,
		username,
		firstName,
		lastName
	);

	return (
		<Avatar
			id={userId}
			name={resolvedName || initials}
			size={size}
			type="round"
		/>
	);
};
