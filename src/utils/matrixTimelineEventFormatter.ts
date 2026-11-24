import {
	getReplyToEventId,
	getThreadRootId,
	getReplaceTargetId,
	getEditedBody,
	stripReplyFallback
} from './messageRelations';
import { getMentionedUserIdsFromContent } from './messageMentions';
import { parsePassageBlurRemovedReason } from '../components/selectionReply/passageBlurEvents';
import { parseCallLifecycleMessage } from './callLifecycleMessage';
import {
	getPassageReplies,
	getPassageRepliesText,
	type PassageReplyAudio
} from '../components/selectionReply/passageReplyContent';
import { getScannedMediaDownloadPath } from '../services/mediaContentScanner';
import type {
	ChatAttachment,
	ChatFile
} from '../components/message/chatAttachmentTypes';
import {
	isMissingKeyDecryptionFailure,
	isUndecryptedRoomEvent
} from './matrixDecryptionFailure';

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

/**
 * A voice clip inside answered passages (ADR-022) as an ordinary encrypted
 * attachment, so it takes the same media route, scanner gate and player as a
 * voice note sent on its own. The recorder's file-name convention carries the
 * length (see voiceMessageFileName.ts).
 */
export const passageReplyAudioAttachment = (
	audio: PassageReplyAudio
): { attachment: ChatAttachment; file: ChatFile } => {
	const mediaRoute = getMatrixMediaRoute(audio.file.url);
	const seconds = Math.max(1, Math.round(audio.durationMs / 1000));
	const extension = audio.mimetype.includes('ogg')
		? 'ogg'
		: audio.mimetype.includes('mp4')
			? 'm4a'
			: 'webm';
	const name = `voice-message-0-s${seconds}-ms${Math.max(
		1000,
		Math.round(audio.durationMs)
	)}.${extension}`;
	return {
		attachment: {
			title: name,
			downloadUrl: mediaRoute.downloadUrl,
			type: 'file',
			mediaType: audio.mimetype,
			size: audio.size,
			encryptedFile: audio.file,
			...(mediaRoute.mxcUrl ? { mxcUrl: mediaRoute.mxcUrl } : {})
		},
		file: { name, type: audio.mimetype }
	};
};

/** Timeline marker of a lifted blur (#2494 *9); `MessageItem.t`. */
export const BLUR_REMOVED_MESSAGE_TYPE = 'blur-removed';

const memberName = (matrixRoom: any, userId: string): string => {
	const member = matrixRoom?.getMember?.(userId);
	return (
		member?.name ||
		member?.rawDisplayName ||
		userId?.split(':')[0]?.substring(1) ||
		''
	);
};

/**
 * Only a room moderator may lift a blur, so only a moderator's redaction
 * counts as one: the marker is a free-text `reason` anybody could type, and
 * an advice seeker deleting their own message must still read "gelöscht",
 * not a platform notice. Moderator = the room's `redact` level (Matrix
 * default 50); the assigned counsellor holds 100, advice seekers 0,
 * supervisors 10 (UserService AssignEnquiryFacade, SessionSupervisorFacade).
 */
const isRoomModerator = (matrixRoom: any, userId: string): boolean => {
	if (!matrixRoom || !userId) return false;
	const levels = matrixRoom.currentState
		?.getStateEvents?.('m.room.power_levels', '')
		?.getContent?.();
	const redactLevel = typeof levels?.redact === 'number' ? levels.redact : 50;
	const level = matrixRoom.getMember?.(userId)?.powerLevel;
	return typeof level === 'number' && level >= redactLevel;
};

/**
 * #2494 *9: the redaction that lifted a blur becomes the platform notice
 * "Schwärzung aufgehoben von <Name>" at the moment it happened; the
 * redacted blur itself shows nothing (it was never a message).
 */
const formatBlurRemoval = (event: any, matrixRoom: any) => {
	const removal = parsePassageBlurRemovedReason(
		event?.getContent?.()?.reason
	);
	if (!removal) return null;
	const removerId = event?.getSender?.() || '';
	if (!isRoomModerator(matrixRoom, removerId)) return null;
	const target = removal.targetEventId
		? matrixRoom?.findEventById?.(removal.targetEventId)
		: undefined;
	const targetSenderId = target?.getSender?.();
	return {
		_id: event?.getId?.() || `${removerId}-${event?.getTs?.()}`,
		msg: '',
		ts: new Date(event?.getTs?.() || Date.now()),
		t: BLUR_REMOVED_MESSAGE_TYPE,
		u: {
			_id: removerId,
			username: removerId?.split(':')[0]?.substring(1) || 'unknown',
			name: memberName(matrixRoom, removerId)
		},
		blurRemoved: {
			targetEventId: removal.targetEventId,
			targetSenderName: targetSenderId
				? memberName(matrixRoom, targetSenderId)
				: undefined
		}
	};
};

const isLiftedBlur = (event: any, matrixRoom: any): boolean => {
	const redaction =
		event?.getUnsigned?.()?.redacted_because ??
		event?.getRedactionEvent?.();
	return (
		Boolean(parsePassageBlurRemovedReason(redaction?.content?.reason)) &&
		isRoomModerator(matrixRoom, redaction?.sender)
	);
};

export const formatMatrixTimelineEvent = (
	event: any,
	matrixRoom: any,
	encryptedFallbackText: string
) => {
	const eventType = event?.getType?.();
	if (eventType === 'm.room.redaction') {
		return formatBlurRemoval(event, matrixRoom);
	}
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
		if (isLiftedBlur(event, matrixRoom)) {
			return null;
		}
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
	const body = typeof content?.body === 'string' ? content.body : '';
	const formattedBody =
		typeof content?.formatted_body === 'string'
			? content.formatted_body
			: '';
	const rawTextContent = isUndecryptedEvent
		? encryptedFallbackText
		: content?.msgtype === 'm.text'
			? formattedBody || body
			: body;
	// ADR-022: several answered passages in one message. The blocks are
	// rendered from the list; the `body` fallback would repeat them, so the
	// message text is only what was typed beside them.
	const passageReplies = isUndecryptedEvent
		? null
		: getPassageReplies(content);
	const textMessageContent = passageReplies
		? getPassageRepliesText(content)
		: replyToEventId
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
	if (passageReplies) {
		baseMessage.passageReplies = passageReplies;
	}
	if (isUndecryptedEvent && isMissingKeyDecryptionFailure(event)) {
		// #1827: lets the timeline show an honest "not on this device" notice
		// instead of the generic encrypted-message text.
		baseMessage.undecryptableReason = 'missing-key';
	}
	const callLifecycle = parseCallLifecycleMessage(content);
	if (callLifecycle) {
		baseMessage.callLifecycle = callLifecycle;
		baseMessage.callLifecycleRevisionTs = event?.getTs?.();
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
		baseMessage.editedCallLifecycle = parseCallLifecycleMessage(
			content?.['m.new_content']
		);
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
		// MSC2530: a `filename` other than `body` makes `body` the caption.
		const filename =
			typeof content.filename === 'string' ? content.filename : '';
		const fileName = filename || body;
		const hasCaption = Boolean(body && filename && body !== filename);
		const attachment: ChatAttachment = {
			title: fileName,
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
		if (hasCaption) {
			attachment.hasCaption = true;
		}
		baseMessage.file = {
			name: fileName,
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
