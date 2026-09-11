import * as React from 'react';
import { Box } from '@mui/material';
import { stepperColors } from '../stepperDesign';
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

/** The line between two dots: solid primary once passed, dotted while ahead. */
export const StepConnector = ({ done, size = 'md' }: StepConnectorProps) => (
	<Box
		aria-hidden
		sx={{
			flexGrow: 1,
			flexShrink: 0,
			minWidth: size === 'sm' ? 18 : 24,
			mt: DOT_CENTRE[size],
			mx: 0.5,
			borderTop: done
				? `3px solid ${stepperColors.primary}`
				: `2.5px dotted ${stepperColors.outline}`
		}}
	/>
);
