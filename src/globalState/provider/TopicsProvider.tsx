import * as React from 'react';
import {
	createContext,
	useState,
	useContext,
	useEffect,
	useCallback
} from 'react';
import { TopicsDataInterface } from '../interfaces';
import { apiGetTopicsData } from '../../api/apiGetTopicsData';
import { LocaleContext } from '../context/LocaleContext';
import { ERROR_LEVEL_WARN, apiPostError } from '../../api/apiPostError';

export const TopicsContext = createContext<{
	topics: Array<TopicsDataInterface>;
	refreshTopics: () => void;
}>(null);

export function TopicsProvider(props) {
	const [topics, setTopics] = useState<Array<TopicsDataInterface>>();
	const { locale } = useContext(LocaleContext);

	const refreshTopics = useCallback(() => {
		apiGetTopicsData()
			.then((topics) => setTopics(topics))
			.catch(() => setTopics([]));
	}, []);

	useEffect(() => {
		refreshTopics();
	}, [refreshTopics, locale]);

	if (topics === undefined) return null;

	return (
		<TopicsContext.Provider value={{ topics, refreshTopics }}>
			{props.children}
		</TopicsContext.Provider>
	);
}

export function getTopics(topics: Array<TopicsDataInterface>, id?: number) {
	if (id == null) {
		return undefined;
	}

	const topic = topics.find((cur) => cur.id === id);
	if (!topic) {
		throw new Error(`No topic found for id "${id}".`);
	}

	return topic;
}

export function useTopics() {
	const { topics } = useContext(TopicsContext);
	if (!topics) {
		throw new Error('`TopicsProvider` was not initialized.');
	}

	return topics;
}

export function useTopic(id?: number) {
	const topics = useTopics();

	try {
		return getTopics(topics, id);
	} catch (e: any) {
		apiPostError({
			name: e.name,
			message: e.message,
			stack: e.stack,
			level: ERROR_LEVEL_WARN
		}).then();
	}

	return null;
}
