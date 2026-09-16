import { stripReplyFallback } from '../../utils/messageRelations';
import { toMessagePreviewText } from '../../utils/messagePreviewText';
import { isErstantwortMessage } from '../erstantwort/erstantwortPayload';
import { parseMessagePrefixes } from '../message/messageConstants';

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
 * `m.thread` relation. Supervision is read from its separately contracted
 * side room, so it does not need to masquerade as a main-room event here.
 */
export type MatrixRoomPreviewChannel = 'thread' | 'supervision';

export interface MatrixRoomPreview {
	kind: MatrixRoomPreviewKind;
	text: string | null;
	/** Absent for the main chat. */
	channel?: MatrixRoomPreviewChannel;
	/**
	 * Length of a voice or audio message in milliseconds, from the event's
	 * `info.duration` (Matrix spec, `m.audio`). Absent when the sender's
	 * client did not record it.
	 */
	durationMs?: number;
}

/** A glyph that stands in for a word on the list card's preview line. */
export type ListPreviewGlyph = 'thread' | 'voice';

export interface ListPreviewLine {
	/** Rendered before the text, in this order. */
	glyphs: ListPreviewGlyph[];
	text: string;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 42_300 → "0:42", 754_000 → "12:34", 3_725_000 → "1:02:05". */
export const formatVoiceDuration = (durationMs: number): string => {
	const totalSeconds = Math.round(durationMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return hours > 0
		? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
		: `${minutes}:${pad2(seconds)}`;
};

/**
 * What the list card writes for the newest message.
 *
 * Frank, 16.09.2026: a thread reply and a voice message are marked by the
 * glyphs the chat already uses — "Sprachnachricht" as a word does not fit the
 * design system, and "Thread:" in front of the text crowds the line. A voice
 * message therefore reads as its glyph and its length; everything else keeps
 * its words, including the "Supervision:" channel prefix.
 */
export const toListPreviewLine = (
	preview: MatrixRoomPreview | null,
	translate: (key: string, fallback?: string) => string
): ListPreviewLine => {
	if (!preview || preview.kind === 'encrypted') {
		return {
			glyphs: [],
			text: translate('e2ee.message.encryption.text')
		};
	}
	const glyphs: ListPreviewGlyph[] = [];
	if (preview.channel === 'thread') {
		glyphs.push('thread');
	}
	let text: string;
	if (preview.kind === 'voice') {
		glyphs.push('voice');
		text =
			preview.durationMs === undefined
				? ''
				: formatVoiceDuration(preview.durationMs);
	} else if (preview.kind === 'text') {
		text = preview.text || '';
	} else {
		text = translate(`sessionList.preview.${preview.kind}`, preview.kind);
	}
	if (preview.channel === 'supervision') {
		text = `${translate('sessionList.preview.channel.supervision')} ${text}`;
	}
	return { glyphs, text };
};

export const getPreviewLastMessageType = (
	isMatrixBackedSession: boolean,
	legacyLastMessageType?: string | null
): string | null =>
	isMatrixBackedSession ? null : legacyLastMessageType || null;

export interface MatrixPreviewEvent {
	getType?: () => string;
	getClearContent?: () => Record<string, any>;
	getContent?: () => Record<string, any>;
	getSender?: () => string;
	getTs?: () => number;
}

interface NormalizedIdentity {
	exact: string;
	localpart: string;
	qualified: boolean;
}

const normalizeIdentity = (
	rawValue?: string | null
): NormalizedIdentity | null => {
	const compact = (rawValue || '').trim().toLowerCase();
	if (!compact) return null;
	const username = compact.startsWith('@')
		? compact.slice(1).split(':')[0]
		: compact.split(':')[0];
	return {
		exact: compact,
		localpart: username,
		qualified: compact.startsWith('@') && compact.includes(':')
	};
};

const identityMatches = (
	candidate: string | null | undefined,
	viewers: NormalizedIdentity[]
): boolean => {
	const normalized = normalizeIdentity(candidate);
	if (!normalized) return false;
	return normalized.qualified
		? viewers.some(
				(viewer) =>
					viewer.qualified && viewer.exact === normalized.exact
			)
		: viewers.some((viewer) => viewer.localpart === normalized.localpart);
};

/**
 * A Matrix timeline can contain ADR-008 asides that are only visible to their
 * sender and named recipients. Filter them before deriving list/rail previews
 * so a private message can never become metadata for another consultant.
 */
export const filterVisibleMatrixPreviewEvents = (
	events: MatrixPreviewEvent[],
	currentUserIds: Array<string | null | undefined>
): MatrixPreviewEvent[] => {
	const viewers = currentUserIds
		.map(normalizeIdentity)
		.filter((identity): identity is NormalizedIdentity => !!identity);
	return events.filter((event) => {
		const content = event.getClearContent?.() || event.getContent?.() || {};
		const body = typeof content.body === 'string' ? content.body : '';
		const { visibleToUserIds } = parseMessagePrefixes(body);
		if (!visibleToUserIds.length) return true;
		if (identityMatches(event.getSender?.(), viewers)) return true;
		return visibleToUserIds.some((recipient) =>
			identityMatches(recipient, viewers)
		);
	});
};

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
		case 'm.audio': {
			const duration = content.info?.duration;
			return {
				kind: Object.prototype.hasOwnProperty.call(
					content,
					'org.matrix.msc3245.voice'
				)
					? 'voice'
					: 'audio',
				text: null,
				...(typeof duration === 'number' &&
				Number.isFinite(duration) &&
				duration >= 0
					? { durationMs: duration }
					: {})
			};
		}
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

export const getLatestTimedMatrixRoomPreview = (
	events: MatrixPreviewEvent[]
): TimedRoomPreview | null => {
	const newestFirst = [...events].sort(
		(a, b) => (b.getTs?.() || 0) - (a.getTs?.() || 0)
	);
	for (const event of newestFirst) {
		const preview = toPreview(event);
		if (preview) {
			return { ...preview, ts: event.getTs?.() || 0 };
		}
	}
	return null;
};

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
 * one. Supervision is selected separately from its `sideRoomId` timeline.
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
