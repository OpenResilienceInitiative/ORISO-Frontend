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
	enabled,
	leading
}: {
	roomId?: string;
	enabled: boolean;
	/** Joins the stack as its first member (upcoming-appointment clock). */
	leading?: React.ReactNode;
}) => {
	const { t } = useTranslation();
	const { status, members } = useGroupCardMembers(roomId, enabled);
	const participants = useMemo(
		() => groupCardParticipants(members),
		[members]
	);
	if (!enabled) return null;
	// The clock does not depend on the members: it shows while they load too.
	if (status !== 'ready')
		return (
			<>
				{leading}
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
			</>
		);
	if (!participants.length)
		return (
			<>
				<span
					data-cy="group-card-members-empty"
					role="status"
					aria-label={t('groupCardParticipants.empty')}
				/>
				{leading}
			</>
		);
	return (
		<ParticipantAvatarStack
			participants={participants}
			size={AVATAR_SIZES.default}
			maxVisible={2}
			overflowStyle="badge"
			leading={leading}
			data-cy="group-card-participants"
		/>
	);
};
