import * as React from 'react';
import { getPrettyDateFromMessageDate } from '../../utils/dateHelpers';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageSendFailed } from './MessageSendFailed';

export interface FailedSend {
	id: string;
	message: string;
	ts: number;
	threadRootId?: string | null;
	transportMessage: string;
	isAside: boolean;
	replyToEventId?: string | null;
	mentionedUserIds: string[];
}

type FailedMessageProps = Omit<
	React.ComponentProps<typeof MessageItemComponent>,
	'_id' | 'message' | 'messageDate' | 'messageTime' | 'sendFailed'
>;

interface FailedSendTimelineEntryProps {
	failed: FailedSend;
	messageProps: FailedMessageProps;
	onRetry?: (failedSendId: string) => void;
	retryPending?: boolean;
	retryDisabled?: boolean;
}

/**
 * Keeps a rejected outgoing message visible in the sender's local timeline and
 * follows it with the recovery explanation. Neither entry is sent to Matrix.
 */
export const FailedSendTimelineEntry = ({
	failed,
	messageProps,
	onRetry,
	retryPending = false,
	retryDisabled = false
}: FailedSendTimelineEntryProps) => {
	const messageTime = String(failed.ts);

	return (
		<>
			<MessageItemComponent
				{...messageProps}
				_id={failed.id}
				message={failed.message}
				messageDate={getPrettyDateFromMessageDate(failed.ts / 1000)}
				messageTime={messageTime}
				sendFailed
			/>
			<MessageSendFailed
				messageTime={messageTime}
				onRetry={onRetry ? () => onRetry(failed.id) : undefined}
				retryPending={retryPending}
				retryDisabled={retryDisabled}
			/>
		</>
	);
};
