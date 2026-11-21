import * as React from 'react';
import { UserAvatar } from '../message/UserAvatar';
import { avatarToneClass, initialsOf } from './calendarAvatar';
import type { CalendarPersonAvatar as PersonAvatar } from './calendarModel';

export interface CalendarPersonAvatarProps {
	/** The name next to the avatar; the initials and tone of the fallback. */
	name: string;
	/** The person's real avatar, when the calendar knows it (FE#2325). */
	avatar?: PersonAvatar;
	/** A step of `AVATAR_SIZES`. */
	size: number;
	/** The place's own avatar class, e.g. `calEntry__avatar`. */
	className: string;
}

/**
 * A person in the calendar: the same avatar the conversation list shows for
 * them (the shared `UserAvatar`), or, without one, their initials in their
 * tone (calendarAvatar.ts). Decorative: the name is always written next to
 * it, so it stays hidden from assistive technology.
 */
export const CalendarPersonAvatar = ({
	name,
	avatar,
	size,
	className
}: CalendarPersonAvatarProps) =>
	avatar ? (
		<span
			className={`${className} calAvatar--user`}
			aria-hidden="true"
			data-testid="calendar-person-avatar"
		>
			<UserAvatar
				username={avatar.username}
				displayName={name}
				userId={avatar.userId}
				choice={avatar.choice}
				size={size}
				ring={false}
				outline={false}
			/>
		</span>
	) : (
		<span
			className={`${className} ${avatarToneClass(name)}`}
			aria-hidden="true"
			style={{
				width: size,
				height: size,
				fontSize: Math.max(8, Math.round(size * 0.36))
			}}
		>
			{initialsOf(name)}
		</span>
	);
