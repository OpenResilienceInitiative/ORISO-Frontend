import * as React from 'react';

/**
 * The "Direkt antworten" arrow of the message action menu, drawn in
 * `currentColor` so it follows the button's text colour.
 */
export const ReplyArrowIcon = ({ className }: { className?: string }) => (
	<svg
		width="18"
		height="14"
		viewBox="0 0 18 14"
		fill="none"
		aria-hidden
		focusable="false"
		className={className}
	>
		<path
			d="M16 14V10C16 9.16667 15.7083 8.45833 15.125 7.875C14.5417 7.29167 13.8333 7 13 7H3.825L7.425 10.6L6 12L0 6L6 0L7.425 1.4L3.825 5H13C14.3833 5 15.5625 5.4875 16.5375 6.4625C17.5125 7.4375 18 8.61667 18 10V14H16Z"
			fill="currentColor"
		/>
	</svg>
);
