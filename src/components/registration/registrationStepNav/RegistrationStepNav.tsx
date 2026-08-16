import * as React from 'react';
import { Box, ButtonBase, CircularProgress, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Link as RouterLink } from 'react-router-dom';
import { registrationMd3 } from '../registrationDesign/registrationDesign';

export interface RegistrationStepNavProps {
	/** `null` on the first step — the circle is then rendered disabled, not hidden. */
	prevStepUrl: string | null;
	onPrevClick?: () => void;
	backLabel: string;
	/** `null` on the last step, where the primary action submits instead of navigating. */
	nextStepUrl: string | null;
	nextLabel: string;
	registerLabel: string;
	registeringLabel: string;
	disabledNext?: boolean;
	isRegistering?: boolean;
}

/**
 * Footer navigation, design F3: a 48 pt back circle and a 56 pt "Weiter" pill
 * with the arrow in its own disc. No sub-line — the picks moved up into the
 * header on mobile, so there is nothing left to say down here.
 *
 * Back is disabled rather than hidden on the first step (ORISO house rule:
 * never hide a control, only disable it), so the footer never changes height.
 */
export const RegistrationStepNav = ({
	prevStepUrl,
	onPrevClick,
	backLabel,
	nextStepUrl,
	nextLabel,
	registerLabel,
	registeringLabel,
	disabledNext = false,
	isRegistering = false
}: RegistrationStepNavProps) => {
	const submitting = isRegistering;
	const primaryLabel = nextStepUrl
		? nextLabel
		: submitting
			? registeringLabel
			: registerLabel;
	const primaryDisabled = disabledNext || submitting;

	return (
		<Box
			data-cy="registration-step-nav"
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1.5,
				width: '100%'
			}}
		>
			<ButtonBase
				component={prevStepUrl ? RouterLink : 'button'}
				to={prevStepUrl ?? undefined}
				onClick={prevStepUrl ? onPrevClick : undefined}
				disabled={!prevStepUrl}
				aria-label={backLabel}
				data-cy="registration-back"
				sx={{
					'width': 48,
					'height': 48,
					'flexShrink': 0,
					'borderRadius': '50%',
					'bgcolor': registrationMd3.surfaceContainer,
					'color': registrationMd3.onSurfaceVariant,
					'&.Mui-disabled': { opacity: 0.38 },
					'&:hover': {
						bgcolor: registrationMd3.surfaceContainerHigh
					},
					'&:focus-visible': {
						boxShadow: `0 0 0 3px ${registrationMd3.focusLayer}`
					}
				}}
			>
				<ArrowBackRoundedIcon />
			</ButtonBase>

			<ButtonBase
				// Always a submit, never a router link: the form's submit
				// handler is what commits this step's answers into the
				// registration data before navigating. A link would move to
				// the next step with the current selection uncommitted, and
				// the next screen would overwrite it. The desktop footer
				// submits for the same reason.
				type={primaryDisabled ? 'button' : 'submit'}
				disabled={disabledNext && !submitting}
				aria-disabled={primaryDisabled}
				aria-busy={submitting}
				onClick={
					submitting
						? (event: React.MouseEvent) => event.preventDefault()
						: undefined
				}
				data-cy="registration-next"
				sx={{
					'flex': 1,
					'minWidth': 0,
					'height': 56,
					'borderRadius': '28px',
					'bgcolor': registrationMd3.primary,
					'color': registrationMd3.onPrimary,
					'boxShadow': `0 6px 0 0 ${registrationMd3.primaryDark}`,
					'display': 'flex',
					'alignItems': 'center',
					'justifyContent': 'space-between',
					'pl': 2.5,
					'pr': 1,
					'transition': 'box-shadow 120ms ease, transform 120ms ease',
					'&:active': {
						boxShadow: `0 2px 0 0 ${registrationMd3.primaryDark}`,
						transform: 'translateY(4px)'
					},
					'&.Mui-disabled': {
						bgcolor: registrationMd3.surfaceContainerHigh,
						color: registrationMd3.onSurfaceVariant,
						boxShadow: 'none'
					},
					'&:focus-visible': {
						outline: `3px solid ${registrationMd3.focusLayer}`,
						outlineOffset: 2
					},
					'@media (prefers-reduced-motion: reduce)': {
						'transition': 'none',
						'&:active': { transform: 'none' }
					}
				}}
			>
				<Typography
					component="span"
					sx={{
						// Typography always resolves to text.primary and never
						// inherits the colour of the surface it sits on, so the
						// label has to say white itself.
						color: 'inherit',
						fontSize: 17,
						fontWeight: 700,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap'
					}}
				>
					{primaryLabel}
				</Typography>
				<Box
					component="span"
					aria-hidden
					sx={{
						width: 40,
						height: 40,
						flexShrink: 0,
						ml: 1,
						borderRadius: '50%',
						bgcolor: primaryDisabled
							? 'transparent'
							: 'rgba(255, 255, 255, 0.16)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					{submitting ? (
						<CircularProgress size={20} color="inherit" />
					) : (
						<ArrowForwardRoundedIcon />
					)}
				</Box>
			</ButtonBase>
		</Box>
	);
};
