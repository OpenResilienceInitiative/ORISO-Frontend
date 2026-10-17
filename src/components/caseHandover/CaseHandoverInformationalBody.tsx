import * as React from 'react';
import { StandingAccessSettings } from './StandingAccessSettings';

/** Body inside the persisted grant's existing bubble. No request controls or automatic invitation. */
export const CaseHandoverInformationalBody = ({
	description,
	sessionId,
	messageId,
	onSetupNotifications,
	mode = 'NONE',
	conversationType
}: {
	description: string;
	sessionId: number;
	messageId?: string;
	onSetupNotifications?: () => void;
	mode?: 'NONE' | 'OPT_IN' | 'OPT_OUT';
	conversationType?: string;
}) => {
	return (
		<>
			<p className="messageItem__systemNotificationDescription">
				{description}
			</p>
			<StandingAccessSettings
				sessionId={sessionId}
				messageId={messageId}
				conversationType={conversationType}
				accessMode={mode}
				onSetupNotifications={onSetupNotifications}
			/>
		</>
	);
};
