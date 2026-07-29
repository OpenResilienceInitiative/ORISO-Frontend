import * as React from 'react';
import { ReactComponent as KeyboardArrowUpIcon } from '../../resources/img/icons/keyboard_arrow_up.svg';

/**
 * M3 split button (Figma "Split button", node 8460:23252): a leading action
 * button and a trailing chevron that opens a related menu. Mirrors the MUI
 * split button pattern used in the Admin panel, restyled with the ORISO M3
 * tokens. The leading label truncates with an ellipsis and never wraps.
 */

interface M3SplitButtonProps {
	label: string;
	leadingIcon?: React.ReactNode;
	/** Selected state renders the button in primary red (Figma state 2+). */
	selected?: boolean;
	/** Whether the attached menu is open — flips the chevron. */
	open?: boolean;
	disabled?: boolean;
	onLeadingClick: () => void;
	onTrailingClick: () => void;
	trailingAriaLabel: string;
	id?: string;
	/**
	 * Whether the leading action opens the attached listbox. When it triggers
	 * a different action (e.g. continue to the next screen), the leading button
	 * must not advertise a popup it does not control (WCAG 4.1.2).
	 */
	leadingOpensMenu?: boolean;
}

/**
 * The keyboard_arrow icon from the ORISO icon set, as the composer's split
 * button uses it. A stroke-only chevron must not be inlined here: sanitize.css
 * sets `svg { fill: currentColor }` app-wide, which fills an open chevron path
 * into a solid wedge.
 */
const ChevronIcon = ({ up }: { up: boolean }) => (
	<KeyboardArrowUpIcon
		aria-hidden
		className={`m3SplitButton__chevron${
			up ? '' : ' m3SplitButton__chevron--down'
		}`}
	/>
);

export const M3SplitButton = React.forwardRef<
	HTMLDivElement,
	M3SplitButtonProps
>(
	(
		{
			label,
			leadingIcon,
			selected = false,
			open = false,
			disabled = false,
			onLeadingClick,
			onTrailingClick,
			trailingAriaLabel,
			id,
			leadingOpensMenu = true
		},
		ref
	) => (
		<div
			className={`m3SplitButton${
				selected ? ' m3SplitButton--selected' : ''
			}`}
			ref={ref}
			id={id}
		>
			<button
				type="button"
				className="m3SplitButton__leading"
				onClick={onLeadingClick}
				disabled={disabled}
				aria-expanded={leadingOpensMenu ? open : undefined}
				aria-haspopup={leadingOpensMenu ? 'listbox' : undefined}
			>
				{leadingIcon && (
					<span className="m3SplitButton__icon" aria-hidden>
						{leadingIcon}
					</span>
				)}
				<span className="m3SplitButton__label">{label}</span>
			</button>
			<button
				type="button"
				className="m3SplitButton__trailing"
				onClick={onTrailingClick}
				disabled={disabled}
				aria-label={trailingAriaLabel}
				aria-expanded={open}
				aria-haspopup="listbox"
			>
				<ChevronIcon up={open} />
			</button>
		</div>
	)
);

M3SplitButton.displayName = 'M3SplitButton';
