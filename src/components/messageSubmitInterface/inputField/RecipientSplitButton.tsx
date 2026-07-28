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
}

/**
 * M3 split button (Figma 1168:23016) for choosing the message recipient(s).
 * Leading button shows the person icon + name on primary-container; trailing
 * button carries the keyboard_arrow_up affordance. Only rendered when a chat
 * has more than two participants.
 */
export const RecipientSplitButton = React.forwardRef<
	HTMLDivElement,
	RecipientSplitButtonProps
>(({ label, icon, isOpen, isMulti = false, onToggle, chevronLabel }, ref) => (
	<div ref={ref} className="recipientSplitButton">
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
));

RecipientSplitButton.displayName = 'RecipientSplitButton';
