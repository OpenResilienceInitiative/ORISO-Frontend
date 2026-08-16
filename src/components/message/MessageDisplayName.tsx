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
	/**
	 * Quiet second line under the name — the counselling centre and its
	 * postcode for messages written by a counsellor (Figma "Message Recipient
	 * Header", App.Oriso 9229:24595). Empty or missing renders nothing at all,
	 * so the header keeps its single-line height everywhere else.
	 */
	subtitle?: string;
}

export const MessageDisplayName = ({
	type,
	username,
	displayName,
	firstName,
	lastName,
	subtitle
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

	const trimmedSubtitle = (subtitle || '').trim();

	return (
		<>
			<div
				className={`messageItem__username messageItem__username--${type}`}
			>
				{getUsernameWithPrefix()}
			</div>
			{trimmedSubtitle && (
				<div className="messageItem__usernameSubtitle">
					{trimmedSubtitle}
				</div>
			)}
		</>
	);
};
