import * as React from 'react';
import { Typography } from '@mui/material';
import { stepperColors } from '../stepperDesign';
import { StepDotSize, StepState } from './StepDot';

export interface StepLabelProps {
	children: string;
	state: StepState;
	size?: StepDotSize;
}

/**
 * Step caption. Never hyphenates and never breaks inside a word: the labels are
 * translated, and a broken "Beratungsstelle" reads as a rendering bug in every
 * language we ship.
 */
export const StepLabel = ({ children, state, size = 'md' }: StepLabelProps) => (
	<Typography
		sx={{
			fontSize: size === 'sm' ? 12 : 13,
			fontWeight: state === 'active' ? 700 : 600,
			color:
				state === 'active'
					? stepperColors.primary
					: stepperColors.onSurfaceVariant,
			lineHeight: 1.2,
			textAlign: 'center',
			overflowWrap: 'normal',
			wordBreak: 'keep-all',
			hyphens: 'none'
		}}
	>
		{children}
	</Typography>
);
