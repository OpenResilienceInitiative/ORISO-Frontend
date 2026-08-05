import * as React from 'react';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import './recipientSplitButton.styles.scss';

export interface RecipientSplitButtonProps {
	label: string;
	icon: React.ReactNode;
	isOpen: boolean;
	isMulti?: boolean;
	onToggle: () => void;
	chevronLabel: string;
	/**
	 * `all` — the message reaches everyone in the conversation: neutral grey.
	 * `targeted` — the audience is restricted: the accent colour, so the
	 * restriction is visible while it is in force (#894 rule B).
	 *
	 * Defaults to `targeted`, the safer of the two to show by mistake.
	 */
	variant?: 'all' | 'targeted';
}

/**
 * M3 split button (Figma 1168:23016) for choosing the message recipient(s).
 * Leading button shows the role icon + name; trailing button carries the
 * keyboard_arrow_up affordance. Only rendered when a chat has more than two
 * participants.
 */
export const RecipientSplitButton = React.forwardRef<
	HTMLDivElement,
	RecipientSplitButtonProps
>(
	(
		{
			label,
			icon,
			isOpen,
			isMulti = false,
			onToggle,
			chevronLabel,
			variant = 'targeted'
		},
		ref
	) => (
	<div
		ref={ref}
		className={`recipientSplitButton recipientSplitButton--${variant}`}
	>
		<button
			type="button"
			className="recipientSplitButton__leading"
			onClick={onToggle}
			aria-haspopup="listbox"
			aria-expanded={isOpen}
		>
			<span className="recipientSplitButton__icon" aria-hidden>
				{icon}
			</span>
			<span
				className={[
					'recipientSplitButton__label',
					isMulti && 'recipientSplitButton__label--multi'
				]
					.filter(Boolean)
					.join(' ')}
			>
				{label}
			</span>
		</button>
		<button
			type="button"
			className="recipientSplitButton__trailing"
			onClick={onToggle}
			aria-label={chevronLabel}
			aria-haspopup="listbox"
			aria-expanded={isOpen}
		>
			<KeyboardArrowUpIcon
				className={[
					'recipientSplitButton__chevron',
					isOpen && 'recipientSplitButton__chevron--open'
				]
					.filter(Boolean)
					.join(' ')}
				fontSize="small"
			/>
		</button>
	</div>
	)
);

RecipientSplitButton.displayName = 'RecipientSplitButton';
