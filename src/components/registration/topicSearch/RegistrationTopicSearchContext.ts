import { createContext } from 'react';
import type { TopicSearchIndex } from './topicSearchEngine';
import type { RegistrationTopicSearchEntry } from './RegistrationTopicSearch';

/** What the topic step offers the header search while it is on screen. */
export interface RegistrationTopicSearchApi {
	entries: RegistrationTopicSearchEntry[];
	index: TopicSearchIndex;
	/** Selects the topic in the list exactly as a click on its row would. */
	select: (topicId: number) => void;
}

/**
 * The search lives in the StageLayout header, the topics and their selection
 * state in the topic step. The step registers itself here; the header renders
 * the magnifier only while something is registered.
 */
export const RegistrationTopicSearchContext = createContext<
	(api: RegistrationTopicSearchApi | null) => void
>(() => {});
