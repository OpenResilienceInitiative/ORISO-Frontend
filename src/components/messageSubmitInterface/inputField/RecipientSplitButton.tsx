import * as React from 'react';
import { SplitButton } from '../../splitButton/SplitButton';
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
		<SplitButton
			ref={ref}
			size="xsmall"
			variant="tonal"
			label={
				<span
					className={
						isMulti
							? 'recipientSplitButton__label--multi'
							: undefined
					}
				>
					{label}
				</span>
			}
			icon={icon}
			className={`recipientSplitButton recipientSplitButton--${variant}`}
			open={isOpen}
			onClick={onToggle}
			onToggleMenu={onToggle}
			menuLabel={chevronLabel}
			menuDirection="up"
		/>
	)
);

RecipientSplitButton.displayName = 'RecipientSplitButton';
