import * as React from 'react';
import { Box } from '@mui/material';
import { stepperColors } from '../stepperDesign';

export interface StepSegmentsProps {
	total: number;
	/** How many segments are filled, i.e. the 1-based index of the current step. */
	current: number;
	/**
	 * Above this many steps the bars stop being countable at a glance and just
	 * become visual noise, so they collapse into a single proportional track.
	 */
	maxSegments?: number;
}

/**
 * The right-hand progress read-out of the compact (mobile) step row. Purely
 * decorative — the "Schritt 2 von 4" text beside it carries the same
 * information for screen readers.
 */
export const StepSegments = ({
	total,
	current,
	maxSegments = 6
}: StepSegmentsProps) => {
	const safeTotal = Math.max(total, 1);
	const filled = Math.min(Math.max(current, 0), safeTotal);

	if (safeTotal > maxSegments) {
		return (
			<Box
				aria-hidden
				sx={{
					width: 96,
					height: 4,
					borderRadius: 2,
					flexShrink: 0,
					bgcolor: stepperColors.surfaceContainerHigh,
					overflow: 'hidden'
				}}
			>
				<Box
					sx={{
						width: `${(filled / safeTotal) * 100}%`,
						height: '100%',
						borderRadius: 2,
						bgcolor: stepperColors.primary
					}}
				/>
			</Box>
		);
	}

	return (
		<Box
			aria-hidden
			sx={{ display: 'flex', gap: '5px', flexShrink: 0, ml: 'auto' }}
		>
			{Array.from({ length: safeTotal }, (_unused, index) => (
				<Box
					key={index}
					sx={{
						width: 18,
						height: 4,
						borderRadius: 2,
						bgcolor:
							index < filled
								? stepperColors.primary
								: stepperColors.surfaceContainerHigh
					}}
				/>
			))}
		</Box>
	);
};
