import * as React from 'react';

export interface ToolbarButtonProps {
	'label': string;
	/** Native hover tooltip (voice-note control). */
	'title'?: string;
	'onClick'?: () => void;
	'selected'?: boolean;
	'expanded'?: boolean;
	'disabled'?: boolean;
	/**
	 * Makes the control unavailable but explained: it stays focusable
	 * (`aria-disabled`, not `disabled`), ignores clicks, shows the reason as
	 * its hover tooltip and exposes it to assistive tech via
	 * `aria-describedby`.
	 */
	'unavailableReason'?: string;
	/** Optional visible text next to the icon (e.g. the "Add" button). */
	'text'?: string;
	'className'?: string;
	'children': React.ReactNode;
	/** Extra attrs for outside-click / toggle coordination. */
	'data-emoji-picker-toggle'?: string;
	'data-cy'?: string;
}

/** 38×32 icon button, radius 12, per Figma Tip Tap menu buttons. */
export const ToolbarButton = ({
	label,
	title,
	onClick,
	selected = false,
	expanded,
	disabled = false,
	unavailableReason,
	text,
	className,
	children,
	'data-emoji-picker-toggle': emojiPickerToggle,
	'data-cy': dataCy
}: ToolbarButtonProps) => {
	const reasonId = React.useId();
	const isUnavailable = Boolean(unavailableReason);
	return (
		<>
			<button
				type="button"
				aria-label={label}
				title={isUnavailable ? unavailableReason : title}
				aria-disabled={isUnavailable || undefined}
				aria-describedby={isUnavailable ? reasonId : undefined}
				aria-pressed={
					expanded === undefined ? selected || undefined : undefined
				}
				aria-expanded={expanded}
				disabled={disabled}
				onClick={isUnavailable ? undefined : onClick}
				data-emoji-picker-toggle={emojiPickerToggle}
				data-cy={dataCy}
				className={[
					'composerToolbar__button',
					text && 'composerToolbar__button--labeled',
					selected && 'composerToolbar__button--selected',
					isUnavailable && 'composerToolbar__button--unavailable',
					className
				]
					.filter(Boolean)
					.join(' ')}
			>
				{children}
				{text && (
					<span className="composerToolbar__buttonText">{text}</span>
				)}
			</button>
			{isUnavailable && (
				<span id={reasonId} className="sr-only">
					{unavailableReason}
				</span>
			)}
		</>
	);
};

export const ToolbarDivider = () => (
	<span className="composerToolbar__divider" aria-hidden="true" />
);
