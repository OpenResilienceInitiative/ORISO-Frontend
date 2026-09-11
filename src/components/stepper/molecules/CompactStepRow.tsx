import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StepSegments } from '../atoms/StepSegments';
import { stepperColors } from '../stepperDesign';

export interface CompactStepRowProps {
	/** 1-based position of the current step. */
	current: number;
	total: number;
	/** Name of the current step, e.g. "Postleitzahl". */
	label: string;
}

/**
 * The 40 pt mobile progress row that replaces the icon stepper below the `sm`
 * breakpoint — seven icon circles never fit on a 375 pt screen, and the icons
 * carried no information the caption did not already give.
 *
 * Desktop keeps the icon stepper; this component is not rendered there.
 */
export const CompactStepRow = ({
	current,
	total,
	label
}: CompactStepRowProps) => {
	const { t } = useTranslation();

	// One interpolated string per locale instead of "{step} {n} {of} {N}".
	// The old concatenation produced nonsense in several languages, because
	// `stepbar.of` was translated as a standalone word ("с сайта", "itibaren").
	const longForm = t('registration.stepper.progress', {
		current,
		total
	});
	const shortForm = t('registration.stepper.progressShort', {
		current,
		total
	});

	return (
		<Box
			data-cy="compact-step-row"
			data-cy-curr={current}
			data-cy-max={total}
			sx={{
				height: 40,
				display: 'flex',
				alignItems: 'center',
				gap: 1.25,
				minWidth: 0
			}}
		>
			<Typography
				aria-hidden
				sx={{
					fontSize: 11,
					fontWeight: 600,
					letterSpacing: '1.1px',
					textTransform: 'uppercase',
					color: stepperColors.onSurfaceVariant,
					flexShrink: 0,
					whiteSpace: 'nowrap'
				}}
			>
				{shortForm}
			</Typography>
			<Typography
				aria-hidden
				sx={{
					fontSize: 14,
					fontWeight: 600,
					color: stepperColors.primary,
					flex: '1 1 auto',
					minWidth: 0,
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				}}
			>
				{label}
			</Typography>
			<StepSegments total={total} current={current} />
			{/* The visible row is abbreviated and truncates; screen readers get
			    the unabridged sentence instead. */}
			<Box
				component="span"
				role="status"
				aria-live="polite"
				sx={{
					position: 'absolute',
					width: '1px',
					height: '1px',
					p: 0,
					m: '-1px',
					overflow: 'hidden',
					clip: 'rect(0 0 0 0)',
					whiteSpace: 'nowrap'
				}}
			>
				{`${longForm}: ${label}`}
			</Box>
		</Box>
	);
};
