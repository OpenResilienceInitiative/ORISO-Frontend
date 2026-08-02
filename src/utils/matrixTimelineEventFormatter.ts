import {
	getReplyToEventId,
	getThreadRootId,
	getReplaceTargetId,
	getEditedBody,
	stripReplyFallback
} from './messageRelations';
import { getMentionedUserIdsFromContent } from './messageMentions';
import type {
	ChatAttachment,
	ChatFile
} from '../components/message/chatAttachmentTypes';

const getMatrixMediaDownloadPath = (contentUrl: string): string => {
	if (!contentUrl.startsWith('mxc://')) {
		return contentUrl;
	}

	const [serverName, mediaId] = contentUrl.substring(6).split('/');
	return `/_matrix/media/r0/download/${serverName}/${mediaId}`;
};

export const formatMatrixTimelineEvent = (
	event: any,
	matrixRoom: any,
	encryptedFallbackText: string
) => {
	const eventType = event?.getType?.();
	if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') {
		return null;
	}

	const content = event?.getClearContent?.() || event?.getContent?.() || {};
	const senderId = event?.getSender?.() || '';
	const senderUsername = senderId?.split(':')[0]?.substring(1) || 'unknown';
	const senderMember = matrixRoom?.getMember?.(senderId);
	const senderDisplayName =
		senderMember?.name || senderMember?.rawDisplayName || senderUsername;
	const isUndecryptedEvent =
		eventType === 'm.room.encrypted' && !content?.msgtype;
	// Relations foundation (#435): replies are the m.in_reply_to relation.
	// The legacy Element quote-fallback in the body would duplicate the quote
	// we render from the relation, so it is stripped for reply events.
	const replyToEventId = getReplyToEventId(content);
	const rawTextContent =
		content?.msgtype === 'm.text'
			? content?.formatted_body || content?.body || ''
			: isUndecryptedEvent
				? encryptedFallbackText
				: content?.body || '';
	const textMessageContent = replyToEventId
		? stripReplyFallback(rawTextContent)
		: rawTextContent;
	const baseMessage: any = {
		_id:
			event?.getId?.() || `${senderId}-${event?.getTs?.() || Date.now()}`,
		msg: textMessageContent,
		ts: new Date(event?.getTs?.() || Date.now()),
		u: {
			_id: senderId,
			username: senderUsername,
			name: senderDisplayName
		}
	};
	if (replyToEventId) {
		baseMessage.replyToEventId = replyToEventId;
	}
	const threadRootEventId = getThreadRootId(content);
	if (threadRootEventId) {
		baseMessage.threadRootEventId = threadRootEventId;
	}
	// Relations foundation (#435): edits (m.replace) are folded onto the
	// original message by applyMessageEdits(); they are not messages on
	// their own, so callers filter them out using replaceTargetId.
	const replaceTargetId = getReplaceTargetId(content);
	if (replaceTargetId) {
		baseMessage.replaceTargetId = replaceTargetId;
		baseMessage.editedBody = getEditedBody(content);
	}
	// Intentional mentions (#435): exposed for downstream UI (e.g. the
	// timeline @mentions filter chip, #420) to test membership against.
	const mentionedUserIds = getMentionedUserIdsFromContent(content);
	if (mentionedUserIds.length > 0) {
		baseMessage.mentionedUserIds = mentionedUserIds;
	}

	const mediaUrl = content?.file?.url || content?.url;
	if (mediaUrl && content?.msgtype !== 'm.text') {
		const downloadPath = getMatrixMediaDownloadPath(mediaUrl);
		const isEncryptedMedia = Boolean(content?.file?.url);
		const attachment: ChatAttachment = {
			title: content.body,
			downloadUrl: downloadPath,
			type: content.msgtype === 'm.image' ? 'image' : 'file',
			mediaType: content.info?.mimetype,
			size: content.info?.size
		};
		// Intrinsic pixel size (sender-provided, WP-4): lets the renderer
		// reserve a correctly-scaled thumbnail box before the image loads.
		if (
			content.msgtype === 'm.image' &&
			typeof content.info?.w === 'number' &&
			typeof content.info?.h === 'number'
		) {
			attachment.width = content.info.w;
			attachment.height = content.info.h;
		}
		if (isEncryptedMedia) {
			attachment.encryptedFile = content.file;
		}
		// Only a fail-closed verdict is accepted from event metadata. A sender
		// cannot mark their own media safe and bypass the recipient-side gate.
		if (content.info?.['org.oriso.media_check_state'] === 'blocked') {
			attachment.mediaCheckState = 'blocked';
		}
		baseMessage.file = {
			name: content.body,
			type: content.info?.mimetype || 'application/octet-stream'
		} satisfies ChatFile;
		if (isEncryptedMedia) {
			baseMessage.t = 'matrix-e2e-file';
		}
		baseMessage.attachments = [attachment];
	}

	return baseMessage;
};

export interface RawReactionEvent {
	eventId: string;
	senderId: string;
	content: unknown;
}

/**
 * Pick `m.reaction` events out of a raw Matrix room timeline. Reactions are
 * a distinct event type (not `m.room.message`), so they never pass through
 * formatMatrixTimelineEvent and are collected separately for
 * aggregateReactions().
 */
export const extractReactionEvents = (events: any[]): RawReactionEvent[] =>
	(events || [])
		.filter((event) => event?.getType?.() === 'm.reaction')
		.map((event) => ({
			eventId: event.getId?.(),
			senderId: event.getSender?.(),
			content: event.getContent?.()
		}));
