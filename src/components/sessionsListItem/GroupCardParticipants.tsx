import * as React from 'react';
import { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ParticipantAvatarStack } from '../message/ParticipantAvatarStack';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import { useGroupCardMembers } from '../../hooks/useGroupCardMembers';
import { ReactComponent as GroupIcon } from '../../resources/img/icons/groups.svg';
import { STACK_MAX_VISIBLE } from '../message/participantStack';
import { groupCardParticipants } from './groupCardMemberParticipants';
import './groupCardParticipants.styles.scss';

const AVATAR = AVATAR_SIZES.message;
const OVERLAP = 24;

/** How wide the stack or the count field is: the card's text wraps around it. */
export const groupCardStackWidth = (count: number): number =>
	count > STACK_MAX_VISIBLE
		? 56 + 10 * `+${count}`.length
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
	// Above four people faces say nothing: one field with the count (Figma 316-16775).
	if (participants.length > STACK_MAX_VISIBLE) {
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
				style={{ width: groupCardStackWidth(participants.length) }}
			>
				+{participants.length}
				<GroupIcon aria-hidden="true" focusable="false" />
			</span>
		);
	}
	return (
		<ParticipantAvatarStack
			participants={participants}
			size={AVATAR}
			overlap={OVERLAP}
			maxVisible={STACK_MAX_VISIBLE}
			data-cy="group-card-participants"
		/>
	);
};
