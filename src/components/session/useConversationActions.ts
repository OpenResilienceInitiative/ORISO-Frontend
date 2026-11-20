import { useCallback, useEffect, useRef, useState } from 'react';
import { chatTransportService } from '../../services/chatTransportService';
import type { MessageItem } from '../message/MessageItemComponent';
import { buildEditContext, buildReplyQuoteContext } from './replyQuote';

type ReplyContext = ReturnType<typeof buildReplyQuoteContext>;
type EditContext = ReturnType<typeof buildEditContext>;

/**
 * #1824 S1: the message actions of one conversation room — react, un-react,
 * delete, and the reply/edit context the composer works on. Shared by the
 * chat (`SessionItemComponent`) and the Activity Timeline preview, so both
 * offer exactly the same actions with the same transport calls.
 *
 * `onWrite` / `onWriteFailed` report a settled react, un-react or delete,
 * with the room it happened in (the view may have moved on by then); the
 * chat ignores them, the preview uses them as its read moment and to show a
 * failure. A reply or edit context never survives a change of
 * `resetKey` (the conversation).
 */
/**
 * The conversation a reply or edit context belongs to: its session and room.
 * The room alone is not enough, since two sessions can both have none yet,
 * and the chat view keeps its state across a session switch.
 */
export const conversationActionsResetKey = (session: {
	rid?: string | null;
	item?: { id?: string | number | null } | null;
}): string => `${session?.item?.id ?? ''}|${session?.rid ?? ''}`;

export const useConversationActions = ({
	roomId,
	resetKey,
	onWrite,
	onWriteFailed
}: {
	roomId: string | null | undefined;
	resetKey?: unknown;
	onWrite?: (roomId: string) => void;
	onWriteFailed?: (roomId: string) => void;
}) => {
	// Refs: callers pass inline callbacks, the handlers must stay stable.
	const onWriteRef = useRef(onWrite);
	onWriteRef.current = onWrite;
	const onWriteFailedRef = useRef(onWriteFailed);
	onWriteFailedRef.current = onWriteFailed;

	const write = useCallback(
		(request: Promise<unknown>, writtenRoomId: string) => {
			request.then(
				() => onWriteRef.current?.(writtenRoomId),
				() => onWriteFailedRef.current?.(writtenRoomId)
			);
		},
		[]
	);

	const handleReact = useCallback(
		(messageId: string, key: string) => {
			if (!roomId) {
				return;
			}
			write(
				chatTransportService.sendReaction({
					matrixRoomId: roomId,
					targetEventId: messageId,
					key
				}),
				roomId
			);
		},
		[roomId, write]
	);

	const handleUnreact = useCallback(
		(reactionEventId: string) => {
			if (!roomId) {
				return;
			}
			write(
				chatTransportService.removeReaction({
					matrixRoomId: roomId,
					reactionEventId
				}),
				roomId
			);
		},
		[roomId, write]
	);

	const handleDeleteDirect = useCallback(
		(message: MessageItem) => {
			if (!roomId || !message?._id) {
				return;
			}
			write(
				chatTransportService.redactMessage({
					matrixRoomId: roomId,
					targetEventId: message._id
				}),
				roomId
			);
		},
		[roomId, write]
	);

	// Relations foundation (#435): direct-reply context for the composer.
	const [replyState, setReplyTo] = useState<{
		key: unknown;
		value: ReplyContext;
	} | null>(null);
	const handleReplyDirect = useCallback(
		(message: MessageItem) => {
			setReplyTo({
				key: resetKey,
				value: buildReplyQuoteContext(message)
			});
		},
		[resetKey]
	);
	const handleCancelReply = useCallback(() => setReplyTo(null), []);

	// Editing (m.replace, #435): edit-in-progress context for the composer.
	const [editState, setEditingMessage] = useState<{
		key: unknown;
		value: EditContext;
	} | null>(null);
	const handleEditDirect = useCallback(
		(message: MessageItem) => {
			setEditingMessage({
				key: resetKey,
				value: buildEditContext(message)
			});
		},
		[resetKey]
	);
	const handleCancelEdit = useCallback(() => setEditingMessage(null), []);

	// A reply or edit context never survives a conversation switch.
	useEffect(() => {
		setReplyTo(null);
		setEditingMessage(null);
	}, [resetKey]);

	return {
		handleReact,
		handleUnreact,
		handleDeleteDirect,
		replyTo:
			replyState && Object.is(replyState.key, resetKey)
				? replyState.value
				: null,
		handleReplyDirect,
		handleCancelReply,
		editingMessage:
			editState && Object.is(editState.key, resetKey)
				? editState.value
				: null,
		handleEditDirect,
		handleCancelEdit
	};
};
