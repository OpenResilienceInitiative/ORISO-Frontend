import { useCallback, useContext, useMemo, useState } from 'react';
import {
	apiGetTenantAgenciesTopics,
	TenantAgenciesTopicsInterface
} from '../../../api/apiGetTenantAgenciesTopics';
import { UserDataContext } from '../../../globalState';
import { AgencyDataInterface } from '../../../globalState/interfaces/UserDataInterface';
import { filterTopicsForAgencies, getAgencyTopicIds } from '../agencyTopics';

/**
 * #2494 *1: the topics and Beratungsstellen a direct link may use, the same
 * selection "Chat erstellen" offers (CreateConversationView). Loaded on
 * demand: the calendar only needs them once "Neue Person per
 * Direkteinladung …" is chosen.
 *
 * #2523: only counsellors invite, so only they load topics (`enabled`).
 * An advice seeker's `agencies` is `null`, not undefined, so a default
 * parameter is not enough: `?? []` keeps the calendar alive for them.
 */
const NO_AGENCIES: AgencyDataInterface[] = [];

export const useDirectLinkTopics = (enabled: boolean) => {
	const { userData } = useContext(UserDataContext);
	const agencies = (enabled && userData?.agencies) || NO_AGENCIES;
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>();
	const [failed, setFailed] = useState(false);

	const load = useCallback(() => {
		if (!enabled) return Promise.resolve();
		setFailed(false);
		return apiGetTenantAgenciesTopics()
			.then((result) => setTopics(result || []))
			.catch(() => {
				setTopics([]);
				setFailed(true);
			});
	}, [enabled]);

	const options = useMemo(
		() =>
			filterTopicsForAgencies(topics ?? [], agencies, null)
				.filter((topic) => topic.id !== undefined)
				.map((topic) => ({
					value: String(topic.id),
					label: topic.name
				})),
		[agencies, topics]
	);
	const agencyTopics = useMemo(
		() =>
			agencies.map((agency) => ({
				id: agency.id,
				topicIds: getAgencyTopicIds([agency], agency.id) ?? []
			})),
		[agencies]
	);

	return {
		topics: options,
		agencies: agencyTopics,
		loaded: topics !== undefined,
		failed,
		load
	};
};
