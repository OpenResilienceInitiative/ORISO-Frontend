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
import { useOwnAvatarUserId } from '../../hooks/useOwnAvatarUserId';
import {
	ALL_ANIMAL_FILES,
	generateAvatarForUser
} from '../../utils/pseudonymGenerator';
import {
	avatarIdOfFile,
	chosenAvatarOf,
	COUNSELLOR_MOTIF_FILES
} from '../../utils/avatarChoice';
import { AvatarPicker, INITIALS_TILE } from './AvatarPicker/AvatarPicker';
import { CounsellorAvatar } from '../message/CounsellorAvatar';
import { Text } from '../text/Text';

interface ProfileAvatarChoiceProps {
	/** The id the user's default avatar is derived from (as in the header). */
	avatarUserId?: string;
}

/**
 * The existing avatar grid inside General's role-specific data card (#1540, US#1240). Counsellors
 * pick initials or an Admin motif, advice seekers an animal; the first tile brings
 * back the default derived from the user id. Saves straight away.
 */
export const ProfileAvatarChoice = ({
	avatarUserId
}: ProfileAvatarChoiceProps = {}) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const ownAvatarUserId = useOwnAvatarUserId();
	const seed = avatarUserId ?? ownAvatarUserId;
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const derived = useMemo(() => generateAvatarForUser(seed), [seed]);
	const askerColors = useMemo(
		() => ({ bg: derived.bg, iconColor: derived.iconColor }),
		[derived]
	);
	const choice = chosenAvatarOf(userData);
	let saved: string | null = null;
	if (choice?.kind === 'initials') {
		if (isConsultant) saved = INITIALS_TILE;
	} else if (choice) {
		saved = choice.file;
	}
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

	const choose = (selection: string | null) => {
		if (loading) return;
		setPending(selection);
		if (selection === INITIALS_TILE) {
			mutate({ avatarKind: 'INITIALS', avatarId: '' });
			return;
		}
		const avatarId = selection ? avatarIdOfFile(selection) : '';
		mutate(
			isConsultant && selection
				? { avatarKind: 'ICON', avatarId }
				: { avatarId }
		);
	};

	return (
		<div
			className="profile__avatarChoice"
			data-testid="profile-avatar-choice"
		>
			<Text text={translate('profile.avatar.label')} type="standard" />
			<AvatarPicker
				layout="grid"
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
				initialsTile={
					isConsultant
						? {
								label: translate('profile.avatar.initials'),
								content: (
									<CounsellorAvatar
										choice={{ kind: 'initials' }}
										displayName={userData.displayName}
										firstName={userData.firstName}
										lastName={userData.lastName}
										username={userData.userName}
										size={52}
									/>
								)
							}
						: undefined
				}
				askerColors={isConsultant ? undefined : askerColors}
				disabled={loading}
			/>
		</div>
	);
};
