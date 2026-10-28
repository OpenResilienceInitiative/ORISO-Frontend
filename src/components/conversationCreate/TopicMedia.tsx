import * as React from 'react';
import { getTopicCardArtwork } from '../../resources/img/topics';
import { ArtworkImage } from './ArtworkImage';

interface TopicMediaProps {
	topic?: string | null;
	alt: string;
}

/** Unknown or unselected agency topics use the approved self-help default. */
export const TopicMedia = ({ topic, alt }: TopicMediaProps) => (
	<ArtworkImage artwork={getTopicCardArtwork(topic)} alt={alt} />
);
