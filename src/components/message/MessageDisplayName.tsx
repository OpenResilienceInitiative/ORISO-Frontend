import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMessagePersonName } from './messageNameUtils';

interface MessageDisplayNameProps {
	isUser: Boolean;
	isMyMessage: Boolean;
	type: 'user' | 'consultant' | 'self' | 'system';
	userId: string;
	username: string;
	displayName?: string;
	firstName?: string;
	lastName?: string;
}

export const MessageDisplayName = ({
	type,
	username,
	displayName,
	firstName,
	lastName
}: MessageDisplayNameProps) => {
	const { t: translate } = useTranslation();

	const getUsernameWithPrefix = useCallback(() => {
		if (type === 'system') {
			return translate(
				'message.systemNotification',
				'System Notification'
			);
		} else {
			return formatMessagePersonName(
				displayName,
				username,
				firstName,
				lastName
			);
		}
	}, [displayName, firstName, lastName, type, translate, username]);

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
