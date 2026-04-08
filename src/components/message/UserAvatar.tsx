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
	const getDisplayName = (rawDisplayName?: string, rawUsername?: string) => {
		const source = (rawDisplayName || rawUsername || '').trim();
		if (!source) {
			return 'User';
		}
		return source;
	};

	const getInitials = (rawDisplayName?: string, rawUsername?: string) => {
		const source = getDisplayName(rawDisplayName, rawUsername);
		const cleaned = source.replace(/[_-]+/g, ' ').trim();
		const parts = cleaned.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
		}
		const compact = cleaned.replace(/\s+/g, '');
		return compact.slice(0, 2).toUpperCase() || 'U';
	};

	const initials = getInitials(displayName, username);

	return <Avatar id={userId} name={initials} size={size} type="round" />;
};
