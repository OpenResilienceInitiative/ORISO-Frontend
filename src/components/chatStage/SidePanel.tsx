/**
 * Side panel organism — Figma has no "side panel" of its own: a supervision
 * room or a thread is simply a second, narrower "Chat Room Desktop"
 * (header · timeline · input field). So this is composition only:
 *
 *   <SidePanel header={<PanelHeader …/>} timeline={<MessageTimeline …/>}
 *              composer={<MessageSubmitInterfaceComponent targetRoomId …/>} />
 *
 * Zero bubble or composer CSS here. `variant="inside"` joins the panel to the
 * open chat card (Frank's choice, hairline between the panes);
 * `variant="card"` wraps it in the chat card chrome as a second card.
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import './sidePanel.styles.scss';

export type SidePanelVariant = 'inside' | 'card' | 'fullscreen';

export interface SidePanelProps {
	'header': React.ReactNode;
	/** Optional info banner between header and timeline (e.g. supervision reason). */
	'banner'?: React.ReactNode;
	'timeline'?: React.ReactNode;
	/** Shown in the timeline slot when `timeline` is empty. */
	'emptyState'?: React.ReactNode;
	'composer'?: React.ReactNode;
	/** Floating switcher (FAB) rendered above the composer. */
	'switcher'?: React.ReactNode;
	'variant'?: SidePanelVariant;
	/** Accessible name of the region, e.g. "Nebenraum: Supervision". */
	'label': string;
	'className'?: string;
	'data-cy'?: string;
}

export const SidePanel = ({
	header,
	banner,
	timeline,
	emptyState,
	composer,
	switcher,
	variant = 'inside',
	label,
	className,
	'data-cy': dataCy = 'side-panel'
}: SidePanelProps) => {
	const timelineRef = useRef<HTMLDivElement | null>(null);
	const hasTimeline = React.Children.toArray(timeline).length > 0;

	// Newest message in view on open and whenever the timeline grows.
	useEffect(() => {
		const node = timelineRef.current;
		if (node) {
			node.scrollTop = node.scrollHeight;
		}
	});

	const classes = ['sidePanel', `sidePanel--${variant}`, className]
		.filter(Boolean)
		.join(' ');

	return (
		<aside className={classes} aria-label={label} data-cy={dataCy}>
			{header}
			{banner && (
				<div className="sidePanel__banner" data-cy="side-panel-banner">
					{banner}
				</div>
			)}
			<div
				ref={timelineRef}
				className="sidePanel__timeline"
				role="log"
				aria-live="polite"
				data-cy="side-panel-timeline"
			>
				{hasTimeline ? timeline : emptyState}
			</div>
			{composer && (
				<div
					className="sidePanel__composer"
					data-cy="side-panel-composer"
				>
					{composer}
				</div>
			)}
			{switcher}
		</aside>
	);
};

export interface InfoBannerProps {
	'title': string;
	'text': string;
	'data-cy'?: string;
}

/**
 * Info banner (supervision reason, "chat starts" note). Column layout so the
 * title never breaks letter by letter in a narrow pane — the
 * `session__supervisionReason` flex-row bug from pre-dev.
 */
export const InfoBanner = ({
	title,
	text,
	'data-cy': dataCy = 'info-banner'
}: InfoBannerProps) => (
	<div className="infoBanner" data-cy={dataCy}>
		<strong className="infoBanner__title">{title}</strong>
		<span className="infoBanner__text">{text}</span>
	</div>
);

export default SidePanel;
