import * as React from 'react';
import './messageDateDivider.styles.scss';

export interface MessageDateDividerProps {
	/** Already-translated label, e.g. "Heute" or "7. Juli 2026". */
	label: string;
}

/**
 * Zeitleiste (Figma 7539-29134): thin divider lines with a centered pink
 * date pill. Pure presentational — used above message groups in the chat
 * timeline.
 */
export const MessageDateDivider: React.FC<MessageDateDividerProps> = ({
	label
}) => (
	<div className="messageDateDivider" role="separator" aria-label={label}>
		<span className="messageDateDivider__line" aria-hidden />
		<span className="messageDateDivider__pill">{label}</span>
		<span className="messageDateDivider__line" aria-hidden />
	</div>
);
