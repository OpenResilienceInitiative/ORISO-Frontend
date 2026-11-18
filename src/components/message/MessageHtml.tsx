import * as React from 'react';

export interface MessageHtmlProps {
	/** Already sanitized message HTML. */
	html: string;
	className?: string;
}

/**
 * The message text as HTML, written to the DOM only when it changes.
 *
 * React 19 compares `dangerouslySetInnerHTML` by object identity, so a bubble
 * that re-renders (hover, the long-press timer on pointer down, a reaction)
 * would rewrite identical HTML and replace every text node. That throws away
 * the reader's text selection mid-drag, which breaks marking a passage for a
 * reply or a blur (#2202). Memoising on the string keeps the nodes.
 */
export const MessageHtml = React.memo(function MessageHtml({
	html,
	className
}: MessageHtmlProps) {
	return (
		<span
			className={className}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
});
