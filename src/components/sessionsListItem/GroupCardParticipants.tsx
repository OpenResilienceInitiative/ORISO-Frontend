import * as React from 'react';
import { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ParticipantAvatarStack } from '../message/ParticipantAvatarStack';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import { useGroupCardMembers } from '../../hooks/useGroupCardMembers';
import { groupCardParticipants } from './groupCardMemberParticipants';
import './groupCardParticipants.styles.scss';

const AVATAR = AVATAR_SIZES.message;
const OVERLAP = 24;
const MAX_FACES = 3;

/** How wide the stack or the count circle is: the card's text wraps around it. */
export const groupCardStackWidth = (count: number): number =>
	count > MAX_FACES
		? AVATAR
		: AVATAR + Math.max(0, count - 1) * (AVATAR - OVERLAP);

/** Group-only: counselling rooms retain their separate silent-membership rules. */
export const GroupCardParticipants = ({
	roomId,
	enabled
}: {
	roomId?: string;
	enabled: boolean;
}) => {
	const { t } = useTranslation();
	const { status, members } = useGroupCardMembers(roomId, enabled);
	const participants = useMemo(
		() => groupCardParticipants(members),
		[members]
	);
	if (!enabled) return null;
	if (status !== 'ready')
		return (
			<span
				data-cy="group-card-members-loading"
				role="status"
				aria-label={t(
					`groupCardParticipants.${status === 'error' ? 'unavailable' : 'loading'}`
				)}
			>
				<Skeleton
					variant="circular"
					width={AVATAR}
					height={AVATAR}
					animation={status === 'error' ? false : 'pulse'}
				/>
			</span>
		);
	if (!participants.length)
		return (
			<span
				data-cy="group-card-members-empty"
				role="status"
				aria-label={t('groupCardParticipants.empty')}
			/>
		);
	// Above three people faces say nothing and take the text's room: one circle
	// of the avatar's size with the count (Frank, 02.11.2026).
	if (participants.length > MAX_FACES) {
		const crowd = t('groupCardParticipants.crowd', {
			count: participants.length
		});
		return (
			<span
				className="groupCardCrowd"
				role="img"
				aria-label={crowd}
				title={crowd}
				data-cy="group-card-crowd"
			>
				{participants.length > 99 ? '99+' : participants.length}
			</span>
		);
	}
	return (
		<ParticipantAvatarStack
			participants={participants}
			size={AVATAR}
			overlap={OVERLAP}
			maxVisible={MAX_FACES}
			data-cy="group-card-participants"
		/>
	);
};
