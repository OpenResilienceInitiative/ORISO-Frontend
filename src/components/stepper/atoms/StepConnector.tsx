import * as React from 'react';
import { Box } from '@mui/material';
import { stepperColors, stepperMotion } from '../stepperDesign';
import { StepDotSize } from './StepDot';

/** Vertical centre of the dot it hangs off, so the line meets the circles. */
const DOT_CENTRE: Record<StepDotSize, string> = {
	sm: '16px',
	md: '21px'
};

export interface StepConnectorProps {
	/** A connector is "done" only when the step before it is behind the user. */
	done: boolean;
	size?: StepDotSize;
}

/**
 * The line between two dots: dotted while ahead, solid primary once passed.
 * The solid line is drawn over the dotted one from left to right, so moving to
 * the next step reads as travelling there (the next dot lights up when the
 * line arrives, see `StepDot`) instead of swapping a style.
 */
export const StepConnector = ({ done, size = 'md' }: StepConnectorProps) => (
	<Box
		aria-hidden
		data-cy="step-connector"
		data-done={done ? 'true' : 'false'}
		sx={{
			'position': 'relative',
			'flexGrow': 1,
			'flexShrink': 0,
			'minWidth': size === 'sm' ? 18 : 24,
			'mt': DOT_CENTRE[size],
			'mx': 0.5,
			'borderTop': `2.5px dotted ${stepperColors.outline}`,
			'&::after': {
				content: '""',
				position: 'absolute',
				// Positioned from the padding edge, so lift it over the dotted border.
				top: '-2.5px',
				left: 0,
				right: 0,
				height: '3px',
				backgroundColor: stepperColors.primary,
				transformOrigin: 'left center',
				transform: done ? 'scaleX(1)' : 'scaleX(0)',
				// Forwards the line travels; backwards it retracts at once so
				// the dot it left does not wait for a line that is not coming.
				transition: done
					? `transform ${stepperMotion.travel} ease-out`
					: 'none'
			},
			'@media (prefers-reduced-motion: reduce)': {
				'&::after': { transition: 'none' }
			}
		}}
	/>
);
