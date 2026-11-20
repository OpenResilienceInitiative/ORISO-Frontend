import * as React from 'react';
import { useMemo } from 'react';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import { CounsellorAvatar } from './CounsellorAvatar';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import type { AvatarChoice } from '../../utils/avatarChoice';
import { formatMessagePersonName } from './messageNameUtils';

interface UserAvatarProps {
	username: string;
	displayName?: string;
	/** Person's name when displayName is a separate session caption. */
	avatarDisplayName?: string;
	firstName?: string;
	lastName?: string;
	userId: string;
	size?: string | number;
	/**
	 * Wraps the avatar in a white circle (per design, all user icons must have
	 * a white circle around them). Defaults to `true`. Pass `false` where the
	 * surrounding container already provides the white ring (e.g. chat messages).
	 */
	ring?: boolean;
	/** The animal circle's own grey outline; see `AnimalAvatar`. */
	outline?: boolean;
	/** The avatar the user picked in their profile (#1240); default when absent. */
	choice?: AvatarChoice | null;
}

/**
 * The canonical saved choice renders consistently across profile and recipients.
 * Without a choice, the stable user id determines the animal and palette.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
	username,
	displayName,
	avatarDisplayName,
	firstName,
	lastName,
	userId,
	size = AVATAR_SIZES.default,
	ring = true,
	outline = true,
	choice
}) => {
	const resolvedName = formatMessagePersonName(
		avatarDisplayName ?? displayName,
		username,
		firstName,
		lastName
	);
	const avatarKey = userId || username || 'unknown';
	const chosenFile = choice?.kind === 'animal' ? choice.file : undefined;
	const avatar = useMemo(() => {
		const derived = generateAvatarForUser(avatarKey);
		if (!chosenFile) return derived;
		return { ...derived, file: chosenFile };
	}, [avatarKey, chosenFile]);

	// Keep the overall footprint equal to `size` so existing fixed-size
	// containers don't shift; the white ring is created by shrinking the inner
	// avatar and padding the difference with a white circular background.
	const totalSize =
		(typeof size === 'number' ? size : parseInt(size, 10)) ||
		AVATAR_SIZES.default;
	const ringWidth = Math.max(3, Math.round(totalSize * 0.125));
	const innerSize = ring ? totalSize - ringWidth * 2 : totalSize;

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
				flexShrink: 0,
				color:
					choice && choice.kind !== 'animal'
						? 'var(--m3-on-primary)'
						: undefined
			}}
		>
			{choice && choice.kind !== 'animal' ? (
				<CounsellorAvatar
					choice={choice}
					displayName={avatarDisplayName ?? displayName}
					firstName={firstName}
					lastName={lastName}
					username={username}
					size={innerSize}
				/>
			) : (
				<AnimalAvatar
					avatar={avatar}
					size={innerSize}
					outline={outline}
				/>
			)}
		</span>
	);
};
