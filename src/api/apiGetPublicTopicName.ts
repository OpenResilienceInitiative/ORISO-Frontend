import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from './fetchData';
import { TopicsDataInterface } from '../globalState/interfaces';

/** A topic's display name; `undefined` on any failure, never an error page. */
export const apiGetPublicTopicName = (
	topicId: number
): Promise<string | undefined> =>
	fetchData({
		url: endpoints.topicsData,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL]
	})
		.then(
			(topics: TopicsDataInterface[]) =>
				topics?.find((topic) => topic.id === topicId)?.name
		)
		.catch(() => undefined);
