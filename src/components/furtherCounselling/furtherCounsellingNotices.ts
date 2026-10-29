/**
 * FE#1876 room notices. The backend posts each as `[SYSTEM_NOTIFICATION]` +
 * JSON (UserService `FurtherCounsellingNotices`). The type strings and the
 * field shapes live here and nowhere else, so a contract change is one edit.
 */
export const FURTHER_COUNSELLING_RECOMMENDED =
	'FURTHER_COUNSELLING_RECOMMENDED';
export const TOPIC_DUPLICATE_STARTED = 'TOPIC_DUPLICATE_STARTED';
export const TOPIC_DUPLICATE_ENDED = 'TOPIC_DUPLICATE_ENDED';

/** The recommend endpoint accepts at most this many characters of note. */
export const FURTHER_COUNSELLING_NOTE_MAX_LENGTH = 1000;

export interface FurtherCounsellingRecommendedNotice {
	type: typeof FURTHER_COUNSELLING_RECOMMENDED;
	topicId: number;
	/** Plain text from the counsellor; rendered as text, never as HTML. */
	note: string | null;
	recommendedBy: string | null;
	createdAt: string | null;
}

/** Topic only: the old room learns nothing about the new conversation. */
export interface TopicDuplicateStartedNotice {
	type: typeof TOPIC_DUPLICATE_STARTED;
	topicId: number;
}

export interface TopicDuplicateEndedNotice {
	type: typeof TOPIC_DUPLICATE_ENDED;
	topicId: number;
}

export type FurtherCounsellingNotice =
	| FurtherCounsellingRecommendedNotice
	| TopicDuplicateStartedNotice
	| TopicDuplicateEndedNotice;

const NOTICE_TYPES: readonly string[] = [
	FURTHER_COUNSELLING_RECOMMENDED,
	TOPIC_DUPLICATE_STARTED,
	TOPIC_DUPLICATE_ENDED
];

export const isFurtherCounsellingNoticeType = (
	type: string | null | undefined
): boolean => !!type && NOTICE_TYPES.includes(type);

const toPositiveId = (value: unknown): number | null => {
	const id =
		typeof value === 'string' && /^\d+$/.test(value.trim())
			? Number(value)
			: value;
	return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
		? id
		: null;
};

const toText = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Reads the JSON payload of a system notification. Returns null for anything
 * that is not one of the three notices or lacks a usable topic id, so the
 * caller falls back to its generic handling.
 */
export const parseFurtherCounsellingNotice = (
	payload: unknown
): FurtherCounsellingNotice | null => {
	if (!payload || typeof payload !== 'object') return null;
	const raw = payload as Record<string, unknown>;
	const type = typeof raw.type === 'string' ? raw.type.trim() : '';
	if (!isFurtherCounsellingNoticeType(type)) return null;
	const topicId = toPositiveId(raw.topicId);
	if (topicId === null) return null;

	if (type === FURTHER_COUNSELLING_RECOMMENDED) {
		const note = toText(raw.note);
		return {
			type,
			topicId,
			note: note
				? note.slice(0, FURTHER_COUNSELLING_NOTE_MAX_LENGTH)
				: null,
			recommendedBy: toText(raw.recommendedBy),
			createdAt: toText(raw.createdAt)
		};
	}
	if (type === TOPIC_DUPLICATE_STARTED) {
		return { type, topicId };
	}
	return { type: TOPIC_DUPLICATE_ENDED, topicId };
};
