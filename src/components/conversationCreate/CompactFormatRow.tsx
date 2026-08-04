import * as React from 'react';

/**
 * Mobile format row (Figma 8482-30552, mobile column of screen 1). Instead of
 * the two stacked desktop cards, mobile lists the formats as full-width rows:
 * round brand icon, title with subtitle, artwork thumbnail on the trailing
 * edge. Selecting a row opens that format's configuration.
 */

interface CompactFormatRowProps {
	icon: React.ReactNode;
	title: string;
	subtitle: string;
	image: string;
	onSelect: () => void;
	selected?: boolean;
}

export const CompactFormatRow = ({
	icon,
	title,
	subtitle,
	image,
	onSelect,
	selected = false
}: CompactFormatRowProps) => (
	<button
		type="button"
		className={`compactFormatRow${
			selected ? ' compactFormatRow--selected' : ''
		}`}
		onClick={onSelect}
		aria-pressed={selected}
	>
		<span className="compactFormatRow__icon" aria-hidden>
			{icon}
		</span>
		<span className="compactFormatRow__text">
			<span className="compactFormatRow__title">{title}</span>
			<span className="compactFormatRow__subtitle">{subtitle}</span>
		</span>
		<img
			className="compactFormatRow__thumb"
			src={image}
			alt=""
			aria-hidden
		/>
	</button>
);
