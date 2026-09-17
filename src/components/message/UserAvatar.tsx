import * as React from 'react';
import { useMemo } from 'react';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import { formatMessagePersonName } from './messageNameUtils';
import { CounsellorAvatar } from './CounsellorAvatar';
import {
	type CounsellorAvatarChoice,
	hasCounsellorAvatar
} from '../../utils/counsellorAvatar';

interface UserAvatarProps extends CounsellorAvatarChoice {
	username: string;
	displayName?: string;
	firstName?: string;
	lastName?: string;
	userId: string;
	size?: string;
	/**
	 * Name the INITIALS are read from, when it differs from `displayName`.
	 * Some call sites label the avatar with the session topic or a rail
	 * caption; initials taken from those would spell the wrong person.
	 */
	avatarDisplayName?: string;
	/**
	 * Wraps the avatar in a white circle (per design, all user icons must have
	 * a white circle around them). Defaults to `true`. Pass `false` where the
	 * surrounding container already provides the white ring (e.g. chat messages).
	 */
	ring?: boolean;
}

/**
 * User avatar, and the single choke point for the counsellor avatar (#1047).
 *
 * A counsellor who CHOSE an avatar (`avatarKind` ICON or INITIALS) renders that
 * choice, tinted to the tenant's brand. Everyone else — every advice seeker,
 * and every counsellor who never chose — keeps the deterministic animal icon
 * derived from the user id (#1193 Job 4), so nothing regresses.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
	username,
	displayName,
	firstName,
	lastName,
	userId,
	size = '32px',
	ring = true,
	avatarKind,
	avatarId,
	avatarDisplayName
}) => {
	const resolvedName = formatMessagePersonName(
		displayName,
		username,
		firstName,
		lastName
	);
	const avatarKey = userId || username || 'unknown';
	const avatar = useMemo(() => generateAvatarForUser(avatarKey), [avatarKey]);

	// Keep the overall footprint equal to `size` so existing fixed-size
	// containers don't shift; the white ring is created by shrinking the inner
	// avatar and padding the difference with a white circular background.
	const totalSize = parseInt(size, 10) || 32;
	const ringWidth = Math.max(3, Math.round(totalSize * 0.125));
	const innerSize = ring ? totalSize - ringWidth * 2 : totalSize;
	const chosenByCounsellor = hasCounsellorAvatar({ avatarKind, avatarId });

	return (
		<span
			// Only a human-readable name may become the accessible name; technical
			// identifiers (anonymous matrix usernames) stay hidden from AT.
			role={resolvedName ? 'img' : undefined}
			aria-label={resolvedName || undefined}
			aria-hidden={resolvedName ? undefined : true}
			data-testid="user-avatar"
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: totalSize,
				height: totalSize,
				borderRadius: '50%',
				background: ring ? '#fff' : 'transparent',
				boxShadow: ring ? '0 2px 8px 0 rgba(0, 0, 0, 0.10)' : 'none',
				boxSizing: 'border-box',
				flexShrink: 0
			}}
		>
			{chosenByCounsellor ? (
				<CounsellorAvatar
					avatarKind={avatarKind}
					avatarId={avatarId}
					displayName={avatarDisplayName ?? displayName}
					firstName={firstName}
					lastName={lastName}
					username={username}
					size={innerSize}
				/>
			) : (
				<AnimalAvatar avatar={avatar} size={innerSize} />
			)}
		</span>
	);
};
