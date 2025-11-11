import * as React from 'react';
import { Avatar } from '@vector-im/compound-web';

interface UserAvatarProps {
	username: string;
	displayName?: string;
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
	userId,
	size = '32px'
}) => {
	// Force FULL uppercase for the avatar letter (Element style)
	const name = displayName || username;
	const uppercaseName = name.toUpperCase();

	return (
		<Avatar
			id={userId}
			name={uppercaseName}
			size={size}
			type="round"
		/>
	);
};
