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
	/**
	 * Wraps the avatar in a white circle (per design, all user icons must have
	 * a white circle around them). Defaults to `true`. Pass `false` where the
	 * surrounding container already provides the white ring (e.g. chat messages).
	 */
	ring?: boolean;
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
	size = '32px',
	ring = true
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

	// Keep the overall footprint equal to `size` so existing fixed-size
	// containers don't shift; the white ring is created by shrinking the inner
	// avatar and padding the difference with a white circular background.
	const totalSize = parseInt(size, 10) || 32;
	const ringWidth = Math.max(3, Math.round(totalSize * 0.125));
	const innerSize = ring ? `${totalSize - ringWidth * 2}px` : size;

	const avatar = (
		<Avatar
			id={userId}
			name={resolvedName || initials}
			size={innerSize}
			type="round"
		/>
	);

	if (!ring) {
		return avatar;
	}

	return (
		<span
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: totalSize,
				height: totalSize,
				borderRadius: '50%',
				background: '#fff',
				boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.10)',
				boxSizing: 'border-box',
				flexShrink: 0
			}}
		>
			{avatar}
		</span>
	);
};
