import {
	getReplyToEventId,
	getThreadRootId,
	getReplaceTargetId,
	getEditedBody,
	stripReplyFallback
} from './messageRelations';
import { getMentionedUserIdsFromContent } from './messageMentions';
import { getScannedMediaDownloadPath } from '../services/mediaContentScanner';
import type {
	ChatAttachment,
	ChatFile
} from '../components/message/chatAttachmentTypes';
import { isUndecryptedRoomEvent } from './matrixDecryptionFailure';

/**
 * Where an attachment's bytes come from.
 *
 * `downloadUrl` is a URL a browser can use on its own — the content scanner,
 * or a non-Matrix URL that was already absolute. `mxcUrl` is media that lives
 * on the homeserver and, since authenticated media (#1487), has no such URL at
 * all: it must be fetched with the Matrix access token attached and handed on
 * as an object URL. That decision belongs to the component that holds a Matrix
 * client, not to this formatter, so the `mxc://` URI is carried through
 * untouched instead of being flattened into a path here.
 */
const getMatrixMediaRoute = (
	contentUrl: string
): { downloadUrl: string; mxcUrl?: string } => {
	if (!contentUrl.startsWith('mxc://')) {
		return { downloadUrl: contentUrl };
	}

	// Where a content scanner is deployed, unencrypted media goes through it
	// too (ADR-019) — otherwise legacy attachments from before the E2EE
	// migration would keep a route that nothing inspects. The scanner serves
	// the bytes itself, so that URL needs no Matrix token.
	const scannedPath = getScannedMediaDownloadPath(contentUrl);
	if (scannedPath) {
		return { downloadUrl: scannedPath };
	}

	return { downloadUrl: '', mxcUrl: contentUrl };
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

	const senderId = event?.getSender?.() || '';
	const senderUsername = senderId?.split(':')[0]?.substring(1) || 'unknown';
	const senderMember = matrixRoom?.getMember?.(senderId);
	const senderDisplayName =
		senderMember?.name || senderMember?.rawDisplayName || senderUsername;

	// Matrix redact (#827): redacted events keep m.room.message type but
	// empty content — surface as legacy deleted state for MessageItem.
	if (event?.isRedacted?.()) {
		return {
			_id:
				event?.getId?.() ||
				`${senderId}-${event?.getTs?.() || Date.now()}`,
			msg: '',
			ts: new Date(event?.getTs?.() || Date.now()),
			t: 'rm',
			u: {
				_id: senderId,
				username: senderUsername,
				name: senderDisplayName
			}
		};
	}

	const content = event?.getClearContent?.() || event?.getContent?.() || {};
	const isUndecryptedEvent = isUndecryptedRoomEvent(event);
	// Relations foundation (#435): replies are the m.in_reply_to relation.
	// The legacy Element quote-fallback in the body would duplicate the quote
	// we render from the relation, so it is stripped for reply events.
	const replyToEventId = getReplyToEventId(content);
	const rawTextContent = isUndecryptedEvent
		? encryptedFallbackText
		: content?.msgtype === 'm.text'
			? content?.formatted_body || content?.body || ''
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
		const mediaRoute = getMatrixMediaRoute(mediaUrl);
		const isEncryptedMedia = Boolean(content?.file?.url);
		const attachment: ChatAttachment = {
			title: content.body,
			downloadUrl: mediaRoute.downloadUrl,
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
		if (mediaRoute.mxcUrl) {
			attachment.mxcUrl = mediaRoute.mxcUrl;
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
