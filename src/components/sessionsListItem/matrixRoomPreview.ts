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

/** A preview plus when it was sent, so a tooltip can date it. */
export interface TimedRoomPreview extends MatrixRoomPreview {
	/** Milliseconds since epoch, from the Matrix event. */
	ts: number;
}

/**
 * The newest message PER CHANNEL, from the events already in memory.
 *
 * Frank, 10.09.2026, sketched a tooltip per mark: the thread icon shows the
 * last thread message, the envelope the last main-channel message. An earlier
 * note in this session called that unreachable, because the session DTO
 * carries one preview per conversation. That was true of the DTO and wrong of
 * this layer: `useMatrixSessionPreview` already pulls the room's last 50
 * decrypted events and subscribes to the timeline, and every one of them
 * already says whether it belongs to a thread. Splitting them by channel is a
 * second pass over an array that is in memory anyway — no fetch, no new
 * subscription.
 *
 * THE ONE REAL LIMIT, and it must be said rather than hidden: the window is
 * those 50 events. A channel whose last message is older than that has no
 * preview here, and the caller shows the mark's own label instead of inventing
 * one. Supervision is not covered at all — it lives in a different Matrix
 * room, which is the same B3 gap the `channel` type above already documents.
 */
export const getRoomPreviewsByChannel = (
	events: MatrixPreviewEvent[]
): { main: TimedRoomPreview | null; thread: TimedRoomPreview | null } => {
	const newestFirst = [...events].sort(
		(a, b) => (b.getTs?.() || 0) - (a.getTs?.() || 0)
	);
	let main: TimedRoomPreview | null = null;
	let thread: TimedRoomPreview | null = null;
	for (const event of newestFirst) {
		if (main && thread) {
			break;
		}
		const preview = toPreview(event);
		if (!preview) {
			continue;
		}
		const timed: TimedRoomPreview = {
			...preview,
			ts: event.getTs?.() || 0
		};
		if (preview.channel === 'thread') {
			thread = thread ?? timed;
		} else {
			main = main ?? timed;
		}
	}
	return { main, thread };
};
