import type { PassageBlur } from './passageBlur';

/**
 * A moderator's blur as a Matrix room event (#2229, decided 12 Nov 2026).
 *
 * The event points at the message and holds only the position — never the
 * text it hides:
 *
 *   type    org.oriso.passage_blur
 *   content {"m.relates_to": {"rel_type": "org.oriso.passage_blur",
 *                             "event_id": "$message"},
 *            "start": 10, "length": 92}
 *
 * Removing the blur redacts this event; a redacted event has no content and
 * drops out here. The original words stay inside the (encrypted) message.
 *
 * Pure and SDK-free: used by the transport (building), the timeline and the
 * chat list (reading).
 */
export const PASSAGE_BLUR_EVENT_TYPE = 'org.oriso.passage_blur';

/** A message never carries more blurs than this; more are ignored. */
export const MAX_BLURS_PER_MESSAGE = 50;
/** Positions beyond this are not a chat message's text. */
const MAX_POSITION = 100_000;

export const buildPassageBlurContent = (
	targetEventId: string,
	blur: Pick<PassageBlur, 'start' | 'length'>
): Record<string, unknown> => ({
	'm.relates_to': {
		rel_type: PASSAGE_BLUR_EVENT_TYPE,
		event_id: targetEventId
	},
	'start': blur.start,
	'length': blur.length
});

/** One blur as read from the room, with who set it. */
export interface PassageBlurEvent extends PassageBlur {
	/** The blurred message. */
	targetEventId: string;
	/** Matrix user id of the moderator who blurred it. */
	senderId: string;
}

interface MatrixLikeEvent {
	getType?: () => string;
	getId?: () => string | undefined;
	getSender?: () => string | undefined;
	getContent?: () => any;
	getClearContent?: () => any;
	isRedacted?: () => boolean;
}

const isPosition = (value: unknown, min: number): value is number =>
	Number.isInteger(value) &&
	(value as number) >= min &&
	(value as number) <= MAX_POSITION;

/** The blur an event sets, or null when it is no (live) blur event. */
export const readPassageBlurEvent = (
	event: MatrixLikeEvent
): PassageBlurEvent | null => {
	if (event?.getType?.() !== PASSAGE_BLUR_EVENT_TYPE) {
		return null;
	}
	if (event.isRedacted?.()) {
		return null;
	}
	const content = event.getClearContent?.() || event.getContent?.() || {};
	const relation = content['m.relates_to'];
	const id = event.getId?.();
	if (
		!id ||
		relation?.rel_type !== PASSAGE_BLUR_EVENT_TYPE ||
		typeof relation?.event_id !== 'string' ||
		!relation.event_id ||
		!isPosition(content.start, 0) ||
		!isPosition(content.length, 1)
	) {
		return null;
	}
	return {
		id,
		targetEventId: relation.event_id,
		start: content.start,
		length: content.length,
		senderId: event.getSender?.() || ''
	};
};

/** Every live blur among `events`, in timeline order. */
export const extractPassageBlurEvents = (
	events: MatrixLikeEvent[] | null | undefined
): PassageBlurEvent[] =>
	(events || [])
		.map(readPassageBlurEvent)
		.filter((blur): blur is PassageBlurEvent => blur !== null);

/** The blurs of each message, keyed by the message's event id. */
export const groupPassageBlurs = (
	blurs: PassageBlurEvent[]
): Map<string, PassageBlurEvent[]> => {
	const byTarget = new Map<string, PassageBlurEvent[]>();
	blurs.forEach((blur) => {
		const list = byTarget.get(blur.targetEventId) || [];
		if (list.length < MAX_BLURS_PER_MESSAGE) {
			list.push(blur);
		}
		byTarget.set(blur.targetEventId, list);
	});
	return byTarget;
};

/** Attach each message's blurs; messages without one stay as they are. */
export const withPassageBlurs = <T extends { _id: string }>(
	messages: T[],
	blurs: Map<string, PassageBlurEvent[]>
): T[] =>
	blurs.size
		? messages.map((message) => {
				const own = blurs.get(message._id);
				return own?.length
					? {
							...message,
							passageBlurs: own.map(({ id, start, length }) => ({
								id,
								start,
								length
							}))
						}
					: message;
			})
		: messages;
