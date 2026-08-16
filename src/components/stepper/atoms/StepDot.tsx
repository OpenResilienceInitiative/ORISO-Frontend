import * as React from 'react';
import { ReactNode } from 'react';
import { Box } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { stepperColors, stepperMotion } from '../stepperDesign';

export type StepState = 'pending' | 'active' | 'done';
export type StepDotSize = 'sm' | 'md';

const DOT_SIZE: Record<StepDotSize, number> = {
	sm: 34,
	md: 44
};

const ICON_SIZE: Record<StepDotSize, number> = {
	sm: 20,
	md: 22
};

export interface StepDotProps {
	state: StepState;
	/** Icon for `pending` and `active`; `done` always renders the check. */
	icon: ReactNode;
	size?: StepDotSize;
	/** Ring around the active dot. Off inside dialogs, where space is tight. */
	emphasizeActive?: boolean;
	className?: string;
}

/**
 * One circle of a step indicator. The single place that decides what
 * "pending / active / done" looks like — the registration flow and the dialog
 * steppers had two divergent copies of this before.
 */
export const StepDot = React.forwardRef<HTMLDivElement, StepDotProps>(
	({ state, icon, size = 'md', emphasizeActive = true, className }, ref) => {
		const filled = state === 'active' || state === 'done';

		return (
			<Box
				ref={ref}
				className={className}
				aria-hidden
				sx={{
					'width': DOT_SIZE[size],
					'height': DOT_SIZE[size],
					'flexShrink': 0,
					'borderRadius': '50%',
					'display': 'flex',
					'alignItems': 'center',
					'justifyContent': 'center',
					'bgcolor': filled
						? stepperColors.primary
						: stepperColors.surfaceContainerHigh,
					'color': filled
						? stepperColors.onPrimary
						: stepperColors.onSurfaceVariant,
					'border': filled
						? 'none'
						: `1.5px solid ${stepperColors.outline}`,
					'boxShadow':
						state === 'active' && emphasizeActive
							? `0 0 0 5px ${stepperColors.selectedLayer}`
							: 'none',
					'transition': `background-color ${stepperMotion.standard} ease, color ${stepperMotion.standard} ease, border-color ${stepperMotion.standard} ease, box-shadow ${stepperMotion.standard} ease`,
					'& svg': {
						fontSize: `${ICON_SIZE[size]}px`,
						width: ICON_SIZE[size],
						height: ICON_SIZE[size]
					},
					'@media (prefers-reduced-motion: reduce)': {
						transition: 'none'
					}
				}}
			>
				{state === 'done' ? <CheckRoundedIcon /> : icon}
			</Box>
		);
	}
);

StepDot.displayName = 'StepDot';
