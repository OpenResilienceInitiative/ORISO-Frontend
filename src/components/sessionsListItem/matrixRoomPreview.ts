import { stripReplyFallback } from '../../utils/messageRelations';
import { toMessagePreviewText } from '../../utils/messagePreviewText';
import { isErstantwortMessage } from '../erstantwort/erstantwortPayload';

export type MatrixRoomPreviewKind =
	| 'text'
	| 'voice'
	| 'audio'
	| 'image'
	| 'video'
	| 'file'
	| 'encrypted'
	| 'first_response';

/**
 * B2 / T24 (Frank: preview prefix): the secondary channel the newest message
 * came from, when the frontend can tell. A thread reply carries the
 * `m.thread` relation. The supervision side room is a different Matrix room
 * the list DTO does not name yet — TODO(B3, UserService): add
 * `SessionDTO.supervision.sideRoomId`, then compare the side room's newest
 * event against the client room's and emit `'supervision'` here.
 */
export type MatrixRoomPreviewChannel = 'thread' | 'supervision';

export interface MatrixRoomPreview {
	kind: MatrixRoomPreviewKind;
	text: string | null;
	/** Absent for the main chat. */
	channel?: MatrixRoomPreviewChannel;
}

export const getPreviewLastMessageType = (
	isMatrixBackedSession: boolean,
	legacyLastMessageType?: string | null
): string | null =>
	isMatrixBackedSession ? null : legacyLastMessageType || null;

interface MatrixPreviewEvent {
	getType?: () => string;
	getClearContent?: () => Record<string, any>;
	getContent?: () => Record<string, any>;
	getTs?: () => number;
}

const toPreview = (event: MatrixPreviewEvent): MatrixRoomPreview | null => {
	const eventType = event.getType?.();
	if (eventType === 'm.room.encrypted') {
		const clearContent = event.getClearContent?.();
		if (!clearContent?.msgtype) {
			return { kind: 'encrypted', text: null };
		}
	}
	if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') {
		return null;
	}

	const content = event.getClearContent?.() || event.getContent?.() || {};
	if (content?.['m.relates_to']?.rel_type === 'm.replace') {
		return null;
	}
	const preview = toKindPreview(content);
	if (preview && content?.['m.relates_to']?.rel_type === 'm.thread') {
		return { ...preview, channel: 'thread' };
	}
	return preview;
};

const toKindPreview = (
	content: Record<string, any>
): MatrixRoomPreview | null => {
	const body = `${content.body || ''}`.trim();
	switch (content.msgtype) {
		case 'm.text':
		case 'm.notice':
		case 'm.emote': {
			if (isErstantwortMessage(body)) {
				return { kind: 'first_response', text: null };
			}
			const text = toMessagePreviewText(stripReplyFallback(body));
			return text ? { kind: 'text', text } : null;
		}
		case 'm.audio':
			return {
				kind: Object.prototype.hasOwnProperty.call(
					content,
					'org.matrix.msc3245.voice'
				)
					? 'voice'
					: 'audio',
				text: null
			};
		case 'm.image':
			return { kind: 'image', text: null };
		case 'm.video':
			return { kind: 'video', text: null };
		case 'm.file':
			return { kind: 'file', text: body || null };
		default:
			return null;
	}
};

export const getLatestMatrixRoomPreview = (
	events: MatrixPreviewEvent[]
): MatrixRoomPreview | null => {
	const newestFirst = [...events].sort(
		(a, b) => (b.getTs?.() || 0) - (a.getTs?.() || 0)
	);
	for (const event of newestFirst) {
		const preview = toPreview(event);
		if (preview) {
			return preview;
		}
	}
	return null;
};
