import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';

type TopicLike = Pick<TopicsDataInterface, 'id'> | undefined | null;
type AgencyLike = Pick<AgencyDataInterface, 'topicIds'> | undefined | null;

/**
 * Whether this counselling centre demonstrably does NOT offer this subject area.
 *
 * The answer decides whether a subject area the advice seeker already picked is
 * thrown away, so it is deliberately asymmetric: only a PROVEN mismatch counts.
 * A centre we do not know, or one whose topic list we could not read, is not
 * proof of anything and must never cost the advice seeker a valid selection —
 * it only means we cannot judge yet.
 *
 * Why it matters beyond the list on screen: the consent sentence and the privacy
 * policy are looked up for the pair (centre × subject area). A pair that does not
 * exist answers 404, which legitimately means "this centre has no own wording,
 * the platform wording applies" — indistinguishable from the genuine case. So a
 * stale subject area does not fail loudly; it silently swaps the legal text the
 * advice seeker consents to. The mismatch has to be caught here instead.
 */
export const agencyExcludesTopic = (
	agency: AgencyLike,
	topic: TopicLike
): boolean => {
	if (!topic?.id) {
		return false;
	}

	if (!agency || !Array.isArray(agency.topicIds)) {
		return false;
	}

	return !agency.topicIds.includes(topic.id);
};
