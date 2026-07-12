import * as React from 'react';

export interface ToolbarButtonProps {
	'label': string;
	'onClick'?: () => void;
	'selected'?: boolean;
	'expanded'?: boolean;
	'disabled'?: boolean;
	/** Optional visible text next to the icon (e.g. the "Add" button). */
	'text'?: string;
	'children': React.ReactNode;
	/** Extra attrs for outside-click / toggle coordination. */
	'data-emoji-picker-toggle'?: string;
}

/** 38×32 icon button, radius 12, per Figma Tip Tap menu buttons. */
export const ToolbarButton = ({
	label,
	onClick,
	selected = false,
	expanded,
	disabled = false,
	text,
	children,
	'data-emoji-picker-toggle': emojiPickerToggle
}: ToolbarButtonProps) => (
	<button
		type="button"
		aria-label={label}
		aria-pressed={
			expanded === undefined ? selected || undefined : undefined
		}
		aria-expanded={expanded}
		disabled={disabled}
		onClick={onClick}
		data-emoji-picker-toggle={emojiPickerToggle}
		className={[
			'composerToolbar__button',
			text && 'composerToolbar__button--labeled',
			selected && 'composerToolbar__button--selected'
		]
			.filter(Boolean)
			.join(' ')}
	>
		{children}
		{text && <span className="composerToolbar__buttonText">{text}</span>}
	</button>
);

export const ToolbarDivider = () => (
	<span className="composerToolbar__divider" aria-hidden="true" />
);
