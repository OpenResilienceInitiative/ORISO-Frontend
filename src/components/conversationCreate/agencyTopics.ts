import { AgencyDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { TenantAgenciesTopicsInterface } from '../../api/apiGetTenantAgenciesTopics';

/**
 * The topics a counsellor may open a Gesprächskreis for.
 *
 * `/service/agencies/topics` answers with every topic of the tenant, which is
 * broader than what this counselling centre offers. The offer is carried on
 * the agency itself (`topicIds`, one department per assigned topic), so the
 * tenant list is narrowed to the selected agency — or, while no agency is
 * chosen yet, to the union across the counsellor's agencies.
 *
 * Backends older than AgencyService #90 send no `topicIds` at all. Filtering
 * against nothing would leave the counsellor with an empty list, so in that
 * case the unfiltered tenant list is kept.
 */

export const getAgencyTopicIds = (
	agencies: AgencyDataInterface[],
	selectedAgencyId: number | null
): number[] | null => {
	const relevant =
		selectedAgencyId === null
			? agencies
			: agencies.filter((agency) => agency.id === selectedAgencyId);
	const ids = relevant.flatMap((agency) => {
		if (agency.topicIds?.length) {
			return agency.topicIds;
		}
		return (agency.departments ?? []).map(
			(department) => department.topicId
		);
	});
	return ids.length ? Array.from(new Set(ids)) : null;
};

export const filterTopicsForAgencies = (
	topics: TenantAgenciesTopicsInterface[],
	agencies: AgencyDataInterface[],
	selectedAgencyId: number | null
): TenantAgenciesTopicsInterface[] => {
	const topicIds = getAgencyTopicIds(agencies, selectedAgencyId);
	if (!topicIds) {
		return topics;
	}
	const offered = topics.filter((topic) => topicIds.includes(topic.id));
	// A selected agency whose topics are unknown to the tenant list would
	// otherwise strand the counsellor without any choice.
	return offered.length ? offered : topics;
};
