import * as React from 'react';
import { TopicTag } from '../topicTag/TopicTag';
import './sessionHeader.styles';

/**
 * The chat header's noninteractive topic strip, also used by protected cases.
 * It is the global topic tag, placed with the header's layout class.
 */
export const SessionTopic = ({ name }: { name: string }) => (
	<TopicTag className="sessionInfo__metaInfo__content">{name}</TopicTag>
);
