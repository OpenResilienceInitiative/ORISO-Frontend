import * as React from 'react';
import { Box } from '@mui/material';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

const SEGMENTS = 8;

export interface MicLevelMeterProps {
	/** 0–1, from an AnalyserNode in the app, a fixture in stories. */
	level: number;
	/** White segments for use on the dark video tile. */
	onDark?: boolean;
	label: string;
}

/**
 * Proof that the microphone hears the person. Segments rather than a smooth
 * bar, so a quiet voice still lights something up (Teams and Element Call's
 * settings both stop at a device list; this is ORISO's own, see #1383).
 */
export const MicLevelMeter = ({
	level,
	onDark = false,
	label
}: MicLevelMeterProps) => {
	const lit = Math.round(Math.min(1, Math.max(0, level)) * SEGMENTS);
	return (
		<Box
			role="meter"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(level * 100)}
			sx={{
				display: 'flex',
				alignItems: 'flex-end',
				gap: '3px',
				height: 18
			}}
		>
			{Array.from({ length: SEGMENTS }, (_, i) => (
				<Box
					key={i}
					sx={{
						'width': 5,
						'height': 6 + i * 1.5,
						'borderRadius': '2px',
						'bgcolor':
							i < lit
								? onDark
									? '#fff'
									: registrationMd3.primary
								: onDark
									? 'rgba(255,255,255,.28)'
									: registrationMd3.surfaceContainerHigh,
						'transition': 'background-color 80ms linear',
						'@media (prefers-reduced-motion: reduce)': {
							transition: 'none'
						}
					}}
				/>
			))}
		</Box>
	);
};
