import * as React from 'react';
import './messageDateDivider.styles.scss';

export interface MessageDateDividerProps {
	/** Already-translated label, e.g. "Heute" or "7. Juli 2026". */
	label: string;
	/** Small leading icon inside the pill (decorative). */
	icon?: React.ReactNode;
	/** `secondary`: a status line in the timeline, not a date (#1869). */
	tone?: 'date' | 'secondary';
}

/**
 * Zeitleiste (Figma 7539-29134): thin divider lines with a centered pink
 * date pill. Pure presentational — used above message groups in the chat
 * timeline.
 */
export const MessageDateDivider: React.FC<MessageDateDividerProps> = ({
	label,
	icon,
	tone = 'date'
}) => (
	<div
		className={`messageDateDivider messageDateDivider--${tone}`}
		role="separator"
		aria-label={label}
	>
		<span className="messageDateDivider__line" aria-hidden />
		<span className="messageDateDivider__pill">
			{icon && (
				<span className="messageDateDivider__icon" aria-hidden>
					{icon}
				</span>
			)}
			{label}
		</span>
		<span className="messageDateDivider__line" aria-hidden />
	</div>
);
