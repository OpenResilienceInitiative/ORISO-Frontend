import React, { useEffect, useMemo, useState } from 'react';
import { UserAvatar } from '../message/UserAvatar';
import { ReactComponent as PeopleIcon } from '../../resources/img/icons/persons-two.svg';
import {
	AVATAR_STACK_METRICS,
	AvatarStackMetrics,
	computeVisibleAvatarCount
} from './GroupChatHeader/memberActivity';

export interface StackMember {
	userId: string;
	username: string;
	displayName: string;
}

interface MemberAvatarStackProps {
	/** Participants, already ordered (latest-active first). */
	members: readonly StackMember[];
	/**
	 * Element whose width bounds the stack (e.g. the header title row). When
	 * omitted or before the first measurement the Figma cap applies.
	 */
	measureRef?: React.RefObject<HTMLElement | null>;
	/** Width in px of the measured element taken by siblings (icon, title). */
	reservedWidth?: number;
	metrics?: AvatarStackMetrics;
	/** Accessible label for the "+N" chip, receives the hidden count. */
	countLabel?: (hidden: number) => string;
}

/**
 * Overlapping participant avatars with a "+N" chip for the members that do
 * not fit (#1193 Job 2). Layout only — ordering and live updates are the
 * caller's job (see GroupChatHeader).
 */
export const MemberAvatarStack: React.FC<MemberAvatarStackProps> = ({
	members,
	measureRef,
	reservedWidth = 0,
	metrics = AVATAR_STACK_METRICS,
	countLabel
}) => {
	const [availableWidth, setAvailableWidth] = useState<number | null>(null);

	useEffect(() => {
		const element = measureRef?.current;
		if (!element || typeof ResizeObserver === 'undefined') {
			setAvailableWidth(null);
			return;
		}
		const update = () =>
			setAvailableWidth(Math.max(0, element.clientWidth - reservedWidth));
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, [measureRef, reservedWidth]);

	const visibleCount = useMemo(
		() =>
			computeVisibleAvatarCount(members.length, availableWidth, metrics),
		[members.length, availableWidth, metrics]
	);
	const visible = members.slice(0, visibleCount);
	const hidden = members.length - visibleCount;

	return (
		<span
			className="sessionInfo__memberAvatars"
			data-testid="member-avatar-stack"
		>
			{visible.map((member, index) => (
				<span
					key={member.userId || `${member.username}-${index}`}
					className="sessionInfo__memberBubble"
					style={{ zIndex: 20 - index }}
				>
					<UserAvatar
						username={member.username}
						displayName={member.displayName}
						userId={member.userId || member.username}
						size={`${metrics.avatarSize}px`}
					/>
				</span>
			))}
			{hidden > 0 && (
				<span
					className="sessionInfo__memberCount"
					aria-label={countLabel?.(hidden)}
					title={countLabel?.(hidden)}
					data-testid="member-avatar-overflow"
				>
					<span className="sessionInfo__memberCountNumber">
						+{hidden}
					</span>
					<PeopleIcon className="sessionInfo__memberCountIcon" />
				</span>
			)}
		</span>
	);
};
