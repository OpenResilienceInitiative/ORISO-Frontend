import * as React from 'react';
import { UserAvatar } from '../message/UserAvatar';
import type { AvatarChoice } from '../../utils/avatarChoice';

interface InlineTypingIndicatorProps {
	name: string;
	userId: string;
	choice?: AvatarChoice | null;
	label: string;
}

/** The inline typing notice uses the same avatar frame as chat messages. */
export const InlineTypingIndicator = ({
	name,
	userId,
	choice,
	label
}: InlineTypingIndicatorProps) => (
	<div className="messageItem session__inlineTypingIndicator">
		<div className="messageItem__messageWrap">
			<div className="messageItem__avatar">
				<UserAvatar
					username={name}
					displayName={name}
					userId={userId}
					choice={choice}
					ring={false}
					chatOutline
				/>
			</div>
			<div className="messageItem__content">
				<div className="session__inlineTypingLabel">{label}</div>
				<div className="session__inlineTypingBubble" aria-hidden="true">
					<div className="session__inlineTypingDots">
						<span />
						<span />
						<span />
					</div>
				</div>
			</div>
		</div>
	</div>
);
