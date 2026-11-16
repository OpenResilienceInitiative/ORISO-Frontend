import * as React from 'react';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import './activityEventBar.styles.scss';

export interface ActivityEventBarProps {
	/** The entry's own glyph from the event-descriptor registry. */
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>> | null;
	title: string;
	/** When the event happened, already formatted for the reader. */
	time: string;
	/** "Beitreten" for a joinable call, else the entry's open label. */
	actionLabel?: string | null;
	onAction?: () => void;
}

/**
 * #2226: the compact bar above the conversation preview of a call or
 * appointment entry — what happened, when, and the one control that acts on
 * it. Selecting the entry only shows the conversation; the call starts only
 * when this button is pressed (Frank, 2026-11-12).
 */
export const ActivityEventBar = ({
	icon: Icon,
	title,
	time,
	actionLabel,
	onAction
}: ActivityEventBarProps) => (
	<div className="activityEventBar" data-cy="activity-event-bar">
		{Icon && (
			<span className="activityEventBar__icon" aria-hidden="true">
				<Icon />
			</span>
		)}
		<div className="activityEventBar__text">
			<h2 className="activityEventBar__title">{title}</h2>
			<p className="activityEventBar__time">{time}</p>
		</div>
		{actionLabel && onAction && (
			<button
				type="button"
				className="activityEventBar__action"
				onClick={onAction}
			>
				<OpenInFullIcon aria-hidden="true" />
				{actionLabel}
			</button>
		)}
	</div>
);
