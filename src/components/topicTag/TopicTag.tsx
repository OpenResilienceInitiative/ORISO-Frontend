import * as React from 'react';
import clsx from 'clsx';
import './topicTag.styles.scss';

export interface TopicTagProps {
	/** The topic name, e.g. "Familienberatung". Renders nothing when empty. */
	children?: React.ReactNode;
	/** Layout hooks of the place that draws the tag (never colours). */
	className?: string;
	/** Selected or hovered card: the tag uses the container colours. */
	emphasis?: boolean;
	title?: string;
}

/**
 * The one topic pill ("Themenberatung"). Colours come from the global
 * `--oriso-topic-tag-*` tokens, so every Träger and every place that shows
 * a topic reads the same; callers only position it.
 */
export const TopicTag = ({
	children,
	className,
	emphasis = false,
	title
}: TopicTagProps) => {
	if (children === undefined || children === null || children === '') {
		return null;
	}
	return (
		<span
			className={clsx(
				'topicTag',
				emphasis && 'topicTag--emphasis',
				className
			)}
			title={title}
		>
			{children}
		</span>
	);
};

export default TopicTag;
