import React, { useEffect, useMemo, useState } from 'react';
import { ParticipantAvatarStack } from '../message/ParticipantAvatarStack';
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
	metrics = AVATAR_STACK_METRICS
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

	const uniqueCount = new Set(
		members.map((member) => member.userId).filter(Boolean)
	).size;
	const visibleCount = useMemo(
		() => computeVisibleAvatarCount(uniqueCount, availableWidth, metrics),
		[uniqueCount, availableWidth, metrics]
	);
	return (
		<ParticipantAvatarStack
			participants={[...members]}
			maxVisible={visibleCount}
			size={metrics.avatarSize}
			overlap={metrics.overlap}
			className="sessionInfo__participants"
			data-cy="group-header-participants"
		/>
	);
};
