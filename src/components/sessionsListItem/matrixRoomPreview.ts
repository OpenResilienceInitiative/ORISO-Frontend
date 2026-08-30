import { stripReplyFallback } from '../../utils/messageRelations';
import { toMessagePreviewText } from '../../utils/messagePreviewText';

export type MatrixRoomPreviewKind =
	| 'text'
	| 'voice'
	| 'audio'
	| 'image'
	| 'video'
	| 'file'
	| 'encrypted';

export interface MatrixRoomPreview {
	kind: MatrixRoomPreviewKind;
	text: string | null;
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

	const body = `${content.body || ''}`.trim();
	switch (content.msgtype) {
		case 'm.text':
		case 'm.notice':
		case 'm.emote':
			return body
				? {
						kind: 'text',
						text: toMessagePreviewText(stripReplyFallback(body))
					}
				: null;
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
