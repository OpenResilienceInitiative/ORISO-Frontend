import * as React from 'react';
import { Box } from '@mui/material';
import { stepperColors } from '../stepperDesign';

export interface StepSegmentsProps {
	total: number;
	/** How many segments are filled, i.e. the 1-based index of the current step. */
	current: number;
	/**
	 * Above this many steps the marks stop being countable at a glance and just
	 * become visual noise, so they collapse into a single proportional track.
	 * Before that they get narrower, and from nine on they are dots.
	 */
	maxSegments?: number;
}

/**
 * The right-hand progress read-out of the compact (mobile) step row. Purely
 * decorative — the "Schritt 2 von 4" text beside it carries the same
 * information for screen readers.
 */
/** Width of the whole read-out; the marks share it, so more steps make each one narrower. */
const TRACK_WIDTH = 96;
/** From this many steps on, a dash is too thin to read as one: the marks become dots. */
const DOTS_FROM = 9;

export const StepSegments = ({
	total,
	current,
	maxSegments = 14
}: StepSegmentsProps) => {
	const safeTotal = Math.max(total, 1);
	const filled = Math.min(Math.max(current, 0), safeTotal);

	if (safeTotal > maxSegments) {
		return (
			<Box
				aria-hidden
				sx={{
					width: TRACK_WIDTH,
					height: 4,
					borderRadius: 2,
					flexShrink: 0,
					bgcolor: stepperColors.surfaceContainerHighest,
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

	// Few steps: dashes of 18 px. More: the dashes share the track and get narrower. Many: dots,
	// small and quiet, since they are a read-out and not something to click (Frank, 2026-11-20).
	const dots = safeTotal >= DOTS_FROM;
	const gap = dots ? 3 : 5;
	const width = dots
		? 5
		: Math.min(
				18,
				Math.floor((TRACK_WIDTH - gap * (safeTotal - 1)) / safeTotal)
			);

	return (
		<Box
			aria-hidden
			data-cy="step-segments"
			data-shape={dots ? 'dots' : 'dashes'}
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: `${gap}px`,
				flexShrink: 0,
				ml: 'auto'
			}}
		>
			{Array.from({ length: safeTotal }, (_unused, index) => (
				<Box
					key={index}
					sx={{
						width,
						height: dots ? 5 : 4,
						borderRadius: 3,
						bgcolor:
							index < filled
								? stepperColors.primary
								: stepperColors.surfaceContainerHighest,
						transition: 'background-color 200ms'
					}}
				/>
			))}
		</Box>
	);
};
