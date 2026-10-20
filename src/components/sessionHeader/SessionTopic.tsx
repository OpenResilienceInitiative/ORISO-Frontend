import * as React from 'react';
import './sessionHeader.styles';

/** The chat header's noninteractive topic strip, also used by protected cases. */
export const SessionTopic = ({ name }: { name: string }) => (
	<div className="sessionInfo__metaInfo__content">{name}</div>
);
