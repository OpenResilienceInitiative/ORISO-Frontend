import { useCallback, useMemo, useRef, useState } from 'react';
import { chatTransportService } from '../../services/chatTransportService';

/**
 * #1824: what the preview does to a room, with the guarantees the Timeline
 * needs: one action at a time, an error the person can see, and the
 * conversation reported read only when a read receipt really went out
 * (D2: writing, reacting, editing, deleting or the explicit button).
 *
 * Reading from the Timeline never registers an active view: everything here
 * is a Matrix event or receipt plus the chat's own message notification.
 */
export const usePreviewActions = ({
	roomId,
	threadRootId,
	sessionId,
	senderDisplayName,
	onConversationRead
}: {
	roomId: string | null;
	threadRootId?: string | null;
	sessionId?: number | null;
	senderDisplayName?: string | null;
	onConversationRead?: () => void;
}) => {
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const busyRef = useRef(false);
	// A ref: callers pass an inline callback; the handlers must stay stable.
	const onConversationReadRef = useRef(onConversationRead);
	onConversationReadRef.current = onConversationRead;

	const markConversationRead = useCallback(async () => {
		if (!roomId) {
			return;
		}
		const receiptSent = await chatTransportService.markRoomAsRead(roomId);
		// Without a receipt the session list would still show unread.
		if (receiptSent) {
			onConversationReadRef.current?.();
		}
	}, [roomId]);

	const run = useCallback(
		async (action: () => Promise<unknown>): Promise<boolean> => {
			if (!roomId || busyRef.current) {
				return false;
			}
			busyRef.current = true;
			setBusy(true);
			setFailed(false);
			try {
				await action();
			} catch {
				setFailed(true);
				return false;
			} finally {
				busyRef.current = false;
				setBusy(false);
			}
			await markConversationRead();
			return true;
		},
		[roomId, markConversationRead]
	);

	// Stable identities: the chat rows receive these as handlers.
	const actions = useMemo(
		() => ({
			send: (message: string, replyToEventId: string | null = null) =>
				run(() =>
					chatTransportService.sendTextMessage({
						matrixRoomId: roomId as string,
						sessionId: sessionId ?? undefined,
						message,
						threadRootId: threadRootId || null,
						replyToEventId,
						senderDisplayName: senderDisplayName || null
					})
				),
			react: (targetEventId: string, key: string) =>
				run(() =>
					chatTransportService.sendReaction({
						matrixRoomId: roomId as string,
						targetEventId,
						key
					})
				),
			unreact: (reactionEventId: string) =>
				run(() =>
					chatTransportService.removeReaction({
						matrixRoomId: roomId as string,
						reactionEventId
					})
				),
			edit: (targetEventId: string, message: string) =>
				run(() =>
					chatTransportService.editTextMessage({
						matrixRoomId: roomId as string,
						targetEventId,
						message
					})
				),
			remove: (targetEventId: string) =>
				run(() =>
					chatTransportService.redactMessage({
						matrixRoomId: roomId as string,
						targetEventId
					})
				)
		}),
		[run, roomId, sessionId, threadRootId, senderDisplayName]
	);

	return { busy, failed, markConversationRead, ...actions };
};
