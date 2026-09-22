import { createContext } from 'react';
import type { TopicSearchIndex } from './topicSearchEngine';
import type { RegistrationTopicSearchEntry } from './RegistrationTopicSearch';

/** What the topic step offers the header search while it is on screen. */
export interface RegistrationTopicSearchApi {
	entries: RegistrationTopicSearchEntry[];
	index: TopicSearchIndex;
	select: (topicId: number) => void;
}

/** Bridges the header (search) and the topic step (topics, selection state). */
export const RegistrationTopicSearchContext = createContext<
	(api: RegistrationTopicSearchApi | null) => void
>(() => {});
