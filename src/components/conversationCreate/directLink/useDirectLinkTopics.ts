import { useCallback, useContext, useMemo, useState } from 'react';
import {
	apiGetTenantAgenciesTopics,
	TenantAgenciesTopicsInterface
} from '../../../api/apiGetTenantAgenciesTopics';
import { UserDataContext } from '../../../globalState';
import { filterTopicsForAgencies, getAgencyTopicIds } from '../agencyTopics';

/**
 * #2494 *1: the topics and Beratungsstellen a direct link may use, the same
 * selection "Chat erstellen" offers (CreateConversationView). Loaded on
 * demand: the calendar only needs them once "Neue Person per
 * Direkteinladung …" is chosen.
 */
export const useDirectLinkTopics = () => {
	const {
		userData: { agencies = [] }
	} = useContext(UserDataContext);
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>();
	const [failed, setFailed] = useState(false);

	const load = useCallback(() => {
		setFailed(false);
		return apiGetTenantAgenciesTopics()
			.then((result) => setTopics(result || []))
			.catch(() => {
				setTopics([]);
				setFailed(true);
			});
	}, []);

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
