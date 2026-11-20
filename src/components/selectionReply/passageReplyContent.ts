import type { MatrixEncryptedFile } from '../../utils/matrixEncryptedAttachment';

/**
 * Matrix content for several answered passages in one message (ADR-022).
 *
 * One `m.room.message` (`msgtype: m.text`) carries the ordered answers in
 * `org.oriso.passage_replies` and a readable fallback in `body`, so clients
 * without ORISO support still show the quotes and answers. The free text typed
 * in the composer travels in `org.oriso.passage_replies_text` (ADR-022 open
 * point 2: beside the list, not only inside `body`).
 *
 * Pure and SDK-free: used by the transport (building) and the timeline
 * formatter (reading).
 */
export const PASSAGE_REPLIES_KEY = 'org.oriso.passage_replies';
export const PASSAGE_REPLIES_TEXT_KEY = 'org.oriso.passage_replies_text';

/** A message answers at most this many passages; more is ignored on read. */
export const MAX_PASSAGE_REPLIES = 20;
/** A stored excerpt is cut here, on send and on read. */
export const MAX_EXCERPT_LENGTH = 1000;

/** A voice clip uploaded for one answer: always an encrypted file. */
export interface PassageReplyAudio {
	file: MatrixEncryptedFile;
	mimetype: string;
	durationMs: number;
	size?: number;
}

/** One answered passage as it is sent and read. */
export interface PassageReplyContentItem {
	eventId: string;
	/** Display name of the passage's author when it was marked. */
	author: string;
	excerpt: string;
	start?: number | null;
	text?: string;
	audio?: PassageReplyAudio | null;
}

export interface PassageRepliesFallbackLabels {
	/** "[Voice message 0:48]" for a clip in the plain-text fallback. */
	voice: (durationSec: number) => string;
}

const clip = (value: string) =>
	value.length > MAX_EXCERPT_LENGTH
		? `${value.slice(0, MAX_EXCERPT_LENGTH - 1)}…`
		: value;

/** Plain-text fallback: each passage as a `>` quote, then its answer. */
export const buildPassageRepliesBody = (
	replies: PassageReplyContentItem[],
	typedText: string,
	labels: PassageRepliesFallbackLabels
): string => {
	const blocks = replies.map((reply) => {
		const lines = [`> ${clip(reply.excerpt).replace(/\s*\n\s*/g, ' ')}`];
		if (reply.audio) {
			lines.push(labels.voice(Math.round(reply.audio.durationMs / 1000)));
		}
		if (reply.text) {
			lines.push(reply.text);
		}
		return lines.join('\n');
	});
	const text = typedText.trim();
	return [...blocks, ...(text ? [text] : [])].join('\n\n');
};

/** `m.room.message` content for the answered passages plus the typed text. */
export const buildPassageRepliesContent = (
	replies: PassageReplyContentItem[],
	typedText: string,
	labels: PassageRepliesFallbackLabels
): Record<string, unknown> => {
	const text = typedText.trim();
	return {
		msgtype: 'm.text',
		body: buildPassageRepliesBody(replies, text, labels),
		[PASSAGE_REPLIES_KEY]: replies.map((reply) => ({
			event_id: reply.eventId,
			author: reply.author,
			excerpt: clip(reply.excerpt),
			...(typeof reply.start === 'number' ? { start: reply.start } : {}),
			...(reply.text ? { text: reply.text } : {}),
			...(reply.audio
				? {
						audio: {
							file: reply.audio.file,
							mimetype: reply.audio.mimetype,
							duration_ms: reply.audio.durationMs,
							...(typeof reply.audio.size === 'number'
								? { size: reply.audio.size }
								: {})
						}
					}
				: {})
		})),
		...(text ? { [PASSAGE_REPLIES_TEXT_KEY]: text } : {})
	};
};

const isString = (value: unknown): value is string => typeof value === 'string';

const readEncryptedFile = (value: any): MatrixEncryptedFile | null =>
	value &&
	isString(value.url) &&
	value.url.startsWith('mxc://') &&
	isString(value.iv) &&
	value.key &&
	isString(value.key.k) &&
	value.hashes &&
	isString(value.hashes.sha256)
		? (value as MatrixEncryptedFile)
		: null;

const readAudio = (value: any): PassageReplyAudio | null => {
	const file = readEncryptedFile(value?.file);
	if (!file) {
		return null;
	}
	const durationMs = Number(value.duration_ms);
	return {
		file,
		mimetype:
			isString(value.mimetype) && value.mimetype.startsWith('audio/')
				? value.mimetype
				: 'audio/webm',
		durationMs:
			Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0,
		...(Number.isFinite(Number(value.size))
			? { size: Number(value.size) }
			: {})
	};
};

/**
 * The answered passages of an event's content, or null when it has none.
 * Malformed entries are dropped; a message never answers more than
 * MAX_PASSAGE_REPLIES passages.
 */
export const getPassageReplies = (
	content: unknown
): PassageReplyContentItem[] | null => {
	const list = (content as Record<string, unknown>)?.[PASSAGE_REPLIES_KEY];
	if (!Array.isArray(list)) {
		return null;
	}
	const replies = list
		.slice(0, MAX_PASSAGE_REPLIES)
		.map((entry: any): PassageReplyContentItem | null => {
			if (
				!entry ||
				!isString(entry.event_id) ||
				!entry.event_id ||
				!isString(entry.excerpt) ||
				!entry.excerpt
			) {
				return null;
			}
			const audio = readAudio(entry.audio);
			const text = isString(entry.text) ? entry.text : undefined;
			if (!audio && !text) {
				return null;
			}
			return {
				eventId: entry.event_id,
				author: isString(entry.author) ? entry.author : '',
				excerpt: clip(entry.excerpt),
				start:
					Number.isInteger(entry.start) && entry.start >= 0
						? entry.start
						: null,
				...(text ? { text } : {}),
				audio
			};
		})
		.filter((entry): entry is PassageReplyContentItem => entry !== null);
	return replies.length ? replies : null;
};

/** The composer text sent beside the answered passages ('' when none). */
export const getPassageRepliesText = (content: unknown): string => {
	const text = (content as Record<string, unknown>)?.[
		PASSAGE_REPLIES_TEXT_KEY
	];
	return isString(text) ? text : '';
};
