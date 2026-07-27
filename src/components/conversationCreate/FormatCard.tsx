import * as React from 'react';

/**
 * M3 stacked card shell (Figma "Stacked card", node 8480:27416): outlined
 * card with header (avatar + title/subtitle + optional overflow slot), a
 * media area and a content area. Both conversation formats on the picker
 * and the internal create card share this shell.
 */

interface FormatCardProps {
	title: string;
	subtitle: string;
	avatar: React.ReactNode;
	/** Rendered inside the fixed-height media area. */
	media?: React.ReactNode;
	/** Blur/dim the media (internal card once a person is selected). */
	mediaDimmed?: boolean;
	/** Overlay rendered on top of the media (person chips). */
	mediaOverlay?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	headerAction?: React.ReactNode;
}

export const FormatCard = ({
	title,
	subtitle,
	avatar,
	media,
	mediaDimmed = false,
	mediaOverlay,
	children,
	className,
	headerAction
}: FormatCardProps) => (
	<section className={`formatCard${className ? ` ${className}` : ''}`}>
		<header className="formatCard__header">
			<span className="formatCard__avatar" aria-hidden>
				{avatar}
			</span>
			<div className="formatCard__headerText">
				<h3 className="formatCard__title">{title}</h3>
				<p className="formatCard__subtitle">{subtitle}</p>
			</div>
			{headerAction && (
				<div className="formatCard__headerAction">{headerAction}</div>
			)}
		</header>
		<div className="formatCard__media">
			<div
				className={`formatCard__mediaContent${
					mediaDimmed ? ' formatCard__mediaContent--dimmed' : ''
				}`}
			>
				{media}
			</div>
			{mediaOverlay && (
				<div className="formatCard__mediaOverlay">{mediaOverlay}</div>
			)}
		</div>
		<div className="formatCard__content">{children}</div>
	</section>
);
