import { isUserModerator } from '../session/sessionHelpers';
import * as React from 'react';
import { useCallback, useContext } from 'react';
import { ActiveSessionContext } from '../../globalState';
import { useTranslation } from 'react-i18next';

interface MessageDisplayNameProps {
	isUser: Boolean;
	isMyMessage: Boolean;
	type: 'user' | 'consultant' | 'self' | 'system';
	userId: string;
	username: string;
	displayName: string;
}

export const MessageDisplayName = ({
	isUser,
	isMyMessage,
	type,
	userId,
	username,
	displayName
}: MessageDisplayNameProps) => {
	const { t: translate } = useTranslation();
	const { activeSession } = useContext(ActiveSessionContext);

	const subscriberIsModerator = isUserModerator({
		chatItem: activeSession.item,
		rcUserId: userId
	});

	const getUsernameWithPrefix = useCallback(() => {
		if (isMyMessage) {
			return translate('message.isMyMessage.name');
		} else {
			// Just show username/displayName without role prefix
			return displayName || username;
		}
	}, [
		displayName,
		isMyMessage,
		username
	]);

	return (
		<>
			<div
				className={`messageItem__username messageItem__username--${type}`}
			>
				{getUsernameWithPrefix()}
			</div>
		</>
	);
};
