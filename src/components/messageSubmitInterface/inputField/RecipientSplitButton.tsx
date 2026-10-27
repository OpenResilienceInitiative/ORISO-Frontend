import * as React from 'react';
import { SplitButton } from '../../splitButton/SplitButton';

export interface RecipientSplitButtonProps {
	label: string;
	icon: React.ReactNode;
	isOpen: boolean;
	isMulti?: boolean;
	onToggle: () => void;
	chevronLabel: string;
	/** Audience semantics stay with the composer; presentation uses the shared atom. */
	variant?: 'all' | 'targeted';
	disabled?: boolean;
}

/** The composer adapter keeps audience routing independent of button geometry. */
export const RecipientSplitButton = React.forwardRef<
	HTMLDivElement,
	RecipientSplitButtonProps
>(
	(
		{
			label,
			icon,
			isOpen,
			onToggle,
			chevronLabel,
			variant = 'targeted',
			disabled = false
		},
		ref
	) => (
		<SplitButton
			ref={ref}
			label={label}
			mainLabel={label}
			icon={icon}
			size="small"
			variant={
				isOpen ? 'elevated' : variant === 'all' ? 'outlined' : 'tonal'
			}
			open={isOpen}
			disabled={disabled}
			onClick={onToggle}
			onToggleMenu={onToggle}
			menuLabel={chevronLabel}
			menuRole="dialog"
		/>
	)
);

RecipientSplitButton.displayName = 'RecipientSplitButton';
