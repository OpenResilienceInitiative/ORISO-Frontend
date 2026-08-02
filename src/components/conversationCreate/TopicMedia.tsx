import * as React from 'react';
import { getTopicCardImage } from '../../resources/img/topics';

/**
 * Card artwork for the Gesprächskreis format. The illustration follows the
 * topic the counsellor picked (Figma: "this images changes based on the topic
 * counsellor selects here"); topics without their own artwork show the generic
 * counselling-circle illustration.
 */

interface TopicMediaProps {
	topic?: string | null;
	alt: string;
}

export const TopicMedia = ({ topic, alt }: TopicMediaProps) => (
	<img
		className="formatCard__mediaImage"
		src={getTopicCardImage(topic)}
		alt={alt}
		width={360}
		height={188}
		loading="lazy"
	/>
);
