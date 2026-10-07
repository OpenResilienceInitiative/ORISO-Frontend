import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	UserDataContext
} from '../../globalState';
import { useUserMutate } from '../../hooks/useUserMutate';
import {
	ALL_ANIMAL_FILES,
	generateAvatarForUser
} from '../../utils/pseudonymGenerator';
import {
	avatarIdOfFile,
	chosenAvatarOf,
	COUNSELLOR_MOTIF_FILES
} from '../../utils/avatarChoice';
import { AvatarPicker } from './AvatarPicker/AvatarPicker';

interface ProfileAvatarChoiceProps {
	/** The id the user's default avatar is derived from (as in the header). */
	avatarUserId: string;
}

/**
 * The avatar row in the profile header (#878 phase 4, US#1240). Counsellors
 * pick from Admin's motif set, advice seekers an animal; the first tile brings
 * back the default derived from the user id. Saves straight away.
 */
export const ProfileAvatarChoice = ({
	avatarUserId
}: ProfileAvatarChoiceProps) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const derived = useMemo(
		() => generateAvatarForUser(avatarUserId),
		[avatarUserId]
	);
	const askerColors = useMemo(
		() => ({ bg: derived.bg, iconColor: derived.iconColor }),
		[derived]
	);
	const choice = chosenAvatarOf(userData);
	const saved = choice && choice.kind !== 'initials' ? choice.file : null;
	// Shows the pick at once; the reloaded user data takes over afterwards.
	const [pending, setPending] = useState<string | null | undefined>();

	const onError = useCallback(() => {
		addNotification({
			notificationType: NOTIFICATION_TYPE_ERROR,
			title: translate('profile.notifications.error.title'),
			text: translate('profile.notifications.error.description')
		});
	}, [addNotification, translate]);
	const { mutate, loading } = useUserMutate({ onError });

	useEffect(() => {
		if (!loading) setPending(undefined);
	}, [loading, saved]);

	const choose = (file: string | null) => {
		if (loading) return;
		setPending(file);
		const avatarId = file ? avatarIdOfFile(file) : '';
		mutate(
			isConsultant && file
				? { avatarKind: 'ICON', avatarId }
				: { avatarId }
		);
	};

	return (
		<div
			className="profile__avatarChoice"
			data-testid="profile-avatar-choice"
		>
			<AvatarPicker
				layout="row"
				role={isConsultant ? 'consultant' : 'asker'}
				files={isConsultant ? COUNSELLOR_MOTIF_FILES : ALL_ANIMAL_FILES}
				value={pending !== undefined ? pending : saved}
				onChange={choose}
				label={translate('profile.avatar.label')}
				defaultTile={{
					avatar: derived,
					label: translate('profile.avatar.default'),
					selected:
						pending !== undefined
							? pending === null
							: choice === null
				}}
				askerColors={isConsultant ? undefined : askerColors}
				disabled={loading}
			/>
		</div>
	);
};
