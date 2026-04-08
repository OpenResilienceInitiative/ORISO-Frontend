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
	// keep reference to session context for future role-based label behavior
	isUserModerator({
		chatItem: activeSession.item,
		rcUserId: userId
	});

	const getDisplayName = useCallback(
		(rawDisplayName: string, rawUsername: string) => {
			const source = (rawDisplayName || rawUsername || '').trim();
			if (!source) {
				return '';
			}
			const cleaned = source.replace(/[_-]+/g, ' ').trim();
			const parts = cleaned.split(/\s+/).filter(Boolean);
			if (parts.length >= 2) {
				return `${parts[0]} ${parts[1]}`;
			}
			return cleaned;
		},
		[]
	);

	const getUsernameWithPrefix = useCallback(() => {
		if (type === 'system') {
			return translate(
				'message.systemNotification',
				'System Notification'
			);
		} else {
			return getDisplayName(displayName, username);
		}
	}, [displayName, getDisplayName, type, translate, username]);

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
