import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatTransportService } from '../../services/chatTransportService';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import { formatMatrixTimelineEvent } from '../../utils/matrixTimelineEventFormatter';
import './conversationPreview.styles';

const PREVIEW_MESSAGE_LIMIT = 50;
const EMPTY_MESSAGES: PreviewMessage[] = [];

interface PreviewMessage {
	id: string;
	senderId: string;
	senderName: string;
	timestamp: Date;
	text: string;
	attachmentTitle: string | null;
	isThreadReply: boolean;
}

/**
 * #847: read-only conversation preview for the Activity Timeline detail pane.
 *
 * Renders the room timeline from the app's OWN Matrix client (already synced
 * and decrypting — ADR-AT-01: previews are hydrated client-side, never
 * server-side). Replaces the old `embeddedNotifications` iframe, which booted
 * a second SPA instance whose SessionItemComponent registered an active view
 * and thereby made the backend suppress the very message.new events the
 * timeline exists to show. This component NEVER registers an active view and
 * sends no read receipts — viewing the preview must not suppress anything.
 */
export const ConversationPreview = ({
	roomId,
	threadRootId
}: {
	roomId: string | null;
	threadRootId?: string | null;
}) => {
	const { t: translate, i18n } = useTranslation();
	const [messages, setMessages] = useState<PreviewMessage[]>(EMPTY_MESSAGES);
	const [roomAvailable, setRoomAvailable] = useState<boolean>(false);
	const listRef = useRef<HTMLDivElement | null>(null);
	// Deliberately a ref: loadMessages must stay identity-stable across
	// renders (its identity drives the subscription effect), and translate's
	// identity is not guaranteed by i18next.
	const translateRef = useRef(translate);
	translateRef.current = translate;
	const ownUserId =
		getMatrixClientService()?.getClient?.()?.getUserId?.() || null;

	const loadMessages = useCallback(() => {
		if (!roomId) {
			setRoomAvailable(false);
			setMessages(EMPTY_MESSAGES);
			return;
		}
		const room = chatTransportService.getMatrixRoom(roomId);
		if (!room) {
			setRoomAvailable(false);
			setMessages(EMPTY_MESSAGES);
			return;
		}
		setRoomAvailable(true);
		const encryptedFallbackText = translateRef.current(
			'e2ee.message.encryption.text'
		);
		const events = chatTransportService.getMatrixRoomMessages(
			roomId,
			PREVIEW_MESSAGE_LIMIT
		);
		const formatted: PreviewMessage[] = events
			.map((event: any) =>
				formatMatrixTimelineEvent(event, room, encryptedFallbackText)
			)
			.filter(Boolean)
			// Edits (m.replace) fold onto their target; they are not rows.
			.filter((message: any) => !message.replaceTargetId)
			.filter((message: any) =>
				threadRootId ? message.threadRootEventId === threadRootId : true
			)
			.map((message: any) => ({
				id: String(message._id),
				senderId: message.u?._id || '',
				senderName: message.u?.name || message.u?.username || '',
				timestamp: message.ts,
				// The formatter may return formatted_body HTML; the preview
				// renders plain text only, so tags are stripped and the value
				// is rendered as a text node (no HTML injection surface).
				text: String(message.msg || '').replace(/<[^>]+>/g, ''),
				attachmentTitle: message.attachments?.[0]?.title || null,
				isThreadReply: Boolean(message.threadRootEventId)
			}));
		setMessages(formatted);
	}, [roomId, threadRootId]);

	useEffect(() => {
		loadMessages();
		if (!roomId) {
			return;
		}
		// Live updates straight from the client's sync (decryption included);
		// deliberately NO active-view registration and NO read receipts.
		const detach = chatTransportService.onMatrixTimeline(roomId, () =>
			loadMessages()
		);
		return () => {
			detach?.();
		};
	}, [roomId, loadMessages]);

	useEffect(() => {
		const list = listRef.current;
		if (list) {
			list.scrollTop = list.scrollHeight;
		}
	}, [messages.length]);

	if (!roomId || !roomAvailable) {
		return (
			<div className="conversationPreview conversationPreview--empty">
				<p className="conversationPreview__notice">
					{translate(
						'notifications.center.preview.unavailable',
						'The conversation preview is not available yet — open the chat to read it.'
					)}
				</p>
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className="conversationPreview conversationPreview--empty">
				<p className="conversationPreview__notice">
					{translate(
						'notifications.center.preview.empty',
						'No messages in this conversation yet.'
					)}
				</p>
			</div>
		);
	}

	return (
		<div className="conversationPreview" ref={listRef}>
			{messages.map((message) => {
				const isOwn =
					Boolean(ownUserId) && message.senderId === ownUserId;
				return (
					<div
						key={message.id}
						className={`conversationPreview__message ${
							isOwn ? 'conversationPreview__message--own' : ''
						}`}
					>
						<div className="conversationPreview__meta">
							<span className="conversationPreview__sender">
								{message.senderName}
							</span>
							<span className="conversationPreview__time">
								{message.timestamp.toLocaleTimeString(
									i18n.language,
									{
										hour: '2-digit',
										minute: '2-digit'
									}
								)}
							</span>
						</div>
						<div className="conversationPreview__bubble">
							{message.text}
							{message.attachmentTitle && (
								<span className="conversationPreview__attachment">
									📎 {message.attachmentTitle}
								</span>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
};
