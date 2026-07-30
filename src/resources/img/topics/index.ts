import fallbackCard from './fallback-card.png';
import schulden from './t-05-schulden.png';

/**
 * Card artwork per counselling topic (Figma annotation: "this image changes
 * based on the topic counsellor selects here"). Keyed on the same slug the
 * registration tiles use (`registration-md3/icons/t-05-schulden.png`), so one
 * naming scheme covers both surfaces.
 *
 * Artwork slot is 360x188 CSS px; assets ship at 2x (720x376).
 * Topics without their own artwork fall back to the generic counselling-circle
 * illustration, so a new topic never renders an empty media area.
 */

const TOPIC_CARDS: Record<string, string> = {
	schulden
};

export const topicSlug = (topic: string): string =>
	topic
		.toLowerCase()
		.replace(/ä/g, 'a')
		.replace(/ö/g, 'o')
		.replace(/ü/g, 'u')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export const getTopicCardImage = (topic?: string | null): string =>
	(topic && TOPIC_CARDS[topicSlug(topic)]) || fallbackCard;

export const hasTopicCardImage = (topic?: string | null): boolean =>
	Boolean(topic && TOPIC_CARDS[topicSlug(topic)]);
