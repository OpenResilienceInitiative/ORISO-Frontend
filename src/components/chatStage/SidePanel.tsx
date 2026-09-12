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
import { useDockedComposerOffset } from './useDockedComposerOffset';
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
	const rootRef = useRef<HTMLElement | null>(null);
	const timelineRef = useRef<HTMLDivElement | null>(null);
	const hasTimeline = React.Children.toArray(timeline).length > 0;
	const switcherOffset = useDockedComposerOffset(rootRef);

	// Newest message in view on open and whenever the timeline grows. The
	// rows animate in (`.messageItem` enters at scale 0.98) and the editor
	// mounts late, so scroll once more after they have settled.
	useEffect(() => {
		const toBottom = () => {
			const node = timelineRef.current;
			if (node) {
				node.scrollTop = node.scrollHeight;
			}
		};
		toBottom();
		const timer = window.setTimeout(toBottom, 400);
		return () => window.clearTimeout(timer);
	});

	// `card` and `fullscreen` are chat cards of their own: the `.session`
	// class brings the card chrome AND scopes the composer stylesheet
	// (`.session .textarea …`), so nothing is restyled here. `inside` sits
	// within the open chat card and inherits both from it.
	const classes = [
		'sidePanel',
		`sidePanel--${variant}`,
		variant !== 'inside' && 'session',
		className
	]
		.filter(Boolean)
		.join(' ');

	return (
		<aside
			ref={rootRef}
			className={classes}
			aria-label={label}
			data-cy={dataCy}
			tabIndex={-1}
		>
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
			{React.isValidElement(switcher)
				? React.cloneElement(switcher as React.ReactElement<any>, {
						bottomOffset: switcherOffset
					})
				: switcher}
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
