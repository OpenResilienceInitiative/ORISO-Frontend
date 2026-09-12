/**
 * The chat timeline organism — the one place that turns a list of
 * `MessageItem`s into rendered rows.
 *
 * Extracted from `SessionItemComponent`'s main `messages.map(...)` without
 * changing a single prop the real `MessageItemComponent` receives, so the
 * bubbles, avatar rings, time rail and reactions are exactly the chat's.
 * Side panels (supervision, threads) mount the same component; there is no
 * second bubble renderer.
 *
 * Renders a fragment on purpose: callers place it inside their own scroll
 * container (`.session__content`, `.sidePanel__timeline`) next to typing
 * indicators and failed-send cards, and the DOM stays as it was.
 */
import * as React from 'react';
import {
	MessageItem,
	MessageItemComponent
} from '../message/MessageItemComponent';
import { MessageSendFailed } from '../message/MessageSendFailed';
import type { AggregatedReaction } from '../../utils/messageRelations';

type MessageItemProps = React.ComponentProps<typeof MessageItemComponent>;

export interface MessageTimelineProps {
	messages: MessageItem[];
	renderMode?: MessageItemProps['renderMode'];
	/** Key namespace when several timelines render the same ids (thread panel). */
	keyPrefix?: string;
	clientName: string;
	/** Per message: whose Matrix id counts as the asker for this row. */
	askerMatrixUserIdFor?: (message: MessageItem) => string | undefined;
	isOnlyEnquiry?: boolean;
	isMyMessage: (userId: string) => boolean;
	isUserBanned?: (username: string) => boolean;
	handleDecryptionErrors: MessageItemProps['handleDecryptionErrors'];
	handleDecryptionSuccess: MessageItemProps['handleDecryptionSuccess'];
	e2eeParams: MessageItemProps['e2eeParams'];
	/** Message ids this client could not decrypt (UTD). */
	decryptionFailures?: ReadonlySet<string>;
	/** Whether the UTD card is shown under a broken message (default: always). */
	showDecryptionCardFor?: (message: MessageItem) => boolean;
	threadsEnabled?: boolean;
	threadRootId?: string | null;
	forceShow?: boolean;
	threadSummaryFor?: (
		messageId: string
	) => MessageItemProps['threadSummary'] | undefined;
	onOpenThread?: (message: MessageItem) => void;
	resolveReplyQuote?: (
		replyToEventId?: string | null
	) => MessageItemProps['replyQuote'];
	onReplyDirect?: (message: MessageItem) => void;
	/** Own messages only — the timeline applies the ownership gate. */
	onEditDirect?: (message: MessageItem) => void;
	/** Own messages only — the timeline applies the ownership gate. */
	onDeleteDirect?: (message: MessageItem) => void;
	reactionsFor?: (messageId: string) => AggregatedReaction[];
	onReact?: (messageId: string, key: string) => void;
	onUnreact?: (reactionEventId: string) => void;
}

const never = () => false;

export const MessageTimeline = ({
	messages,
	renderMode = 'main',
	keyPrefix = '',
	clientName,
	askerMatrixUserIdFor,
	isOnlyEnquiry = false,
	isMyMessage,
	isUserBanned = never,
	handleDecryptionErrors,
	handleDecryptionSuccess,
	e2eeParams,
	decryptionFailures,
	showDecryptionCardFor,
	threadsEnabled = true,
	threadRootId,
	forceShow,
	threadSummaryFor,
	onOpenThread,
	resolveReplyQuote,
	onReplyDirect,
	onEditDirect,
	onDeleteDirect,
	reactionsFor,
	onReact,
	onUnreact
}: MessageTimelineProps) => (
	<>
		{messages.map((message: MessageItem, index) => {
			const own = isMyMessage(message.userId);
			const broke = decryptionFailures?.has(message._id) ?? false;
			return (
				<React.Fragment key={`${keyPrefix}${message._id}-${index}`}>
					<MessageItemComponent
						clientName={clientName}
						askerMatrixUserId={
							askerMatrixUserIdFor
								? askerMatrixUserIdFor(message)
								: message.askerMatrixUserId
						}
						isOnlyEnquiry={isOnlyEnquiry}
						isMyMessage={own}
						isUserBanned={isUserBanned(message.username)}
						handleDecryptionErrors={handleDecryptionErrors}
						handleDecryptionSuccess={handleDecryptionSuccess}
						e2eeParams={e2eeParams}
						renderMode={renderMode}
						threadsEnabled={threadsEnabled}
						threadRootId={threadRootId}
						forceShow={forceShow}
						threadSummary={threadSummaryFor?.(message._id)}
						onOpenThread={
							onOpenThread
								? () => onOpenThread(message)
								: undefined
						}
						replyQuote={resolveReplyQuote?.(message.replyToEventId)}
						onReplyDirect={
							onReplyDirect
								? () => onReplyDirect(message)
								: undefined
						}
						onEditDirect={
							own && onEditDirect
								? () => onEditDirect(message)
								: undefined
						}
						onDeleteDirect={
							own && onDeleteDirect
								? () => onDeleteDirect(message)
								: undefined
						}
						reactions={reactionsFor?.(message._id)}
						onReact={
							onReact
								? (key: string) => onReact(message._id, key)
								: undefined
						}
						onUnreact={onUnreact}
						{...message}
						encryptionBroke={broke}
					/>
					{broke &&
						(showDecryptionCardFor
							? showDecryptionCardFor(message)
							: true) && (
							<MessageSendFailed
								messageTime={message.messageTime}
								isDecryptionFailure
							/>
						)}
				</React.Fragment>
			);
		})}
	</>
);

export default MessageTimeline;
