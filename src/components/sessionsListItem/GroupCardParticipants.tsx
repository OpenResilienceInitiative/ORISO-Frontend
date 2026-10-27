import * as React from 'react';
import { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ParticipantAvatarStack } from '../message/ParticipantAvatarStack';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import { useGroupCardMembers } from '../../hooks/useGroupCardMembers';
import { groupCardParticipants } from './groupCardMemberParticipants';

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
					width={AVATAR_SIZES.default}
					height={AVATAR_SIZES.default}
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
	return (
		<ParticipantAvatarStack
			participants={participants}
			size={AVATAR_SIZES.default}
			maxVisible={2}
			data-cy="group-card-participants"
		/>
	);
};
