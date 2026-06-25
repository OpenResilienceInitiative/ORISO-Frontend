import { TopicsDataInterface } from '../../../globalState/interfaces';
import { TenantAgenciesTopicsInterface } from '../../../api/apiGetTenantAgenciesTopics';

/**
 * Keep only the topics that have at least one agency assigned, so the registration
 * topic step cannot dead-end on a topic with zero counselling centres.
 *
 * The registration agency query joins `agency_topic`, so a topic without any linked
 * agency always yields an empty agency list ("Keine Online-Beratungsstelle gefunden").
 * Offering such topics is a guaranteed dead-end; this filter removes them.
 *
 * Fails open: if the agency coverage cannot be determined (request failed or returned
 * nothing), the topics are returned unchanged so registration stays usable.
 *
 * @param topics         the topics fetched for registration
 * @param agenciesTopics the topics that currently have at least one agency assigned
 *                       (from `GET /service/agencies/topics`); `null`/empty disables filtering
 * @return the topics that have agency coverage (or all topics if coverage is unknown)
 */
export const filterTopicsByAgencyCoverage = (
	topics: TopicsDataInterface[],
	agenciesTopics?: TenantAgenciesTopicsInterface[] | null
): TopicsDataInterface[] => {
	if (!Array.isArray(agenciesTopics) || agenciesTopics.length === 0) {
		return topics;
	}
	const coveredTopicIds = new Set(agenciesTopics.map((topic) => topic.id));
	return topics.filter((topic) => coveredTopicIds.has(topic.id));
};
