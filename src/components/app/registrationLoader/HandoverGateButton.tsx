import * as React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import {
	GATE_IS_OPEN,
	GATE_PROGRESS,
	GATE_STATUS_FALLBACK,
	GATE_STATUS_KEY,
	HandoverGateState
} from './handoverGate';

export interface HandoverGateButtonProps {
	state: HandoverGateState;
	onEnter: () => void;
}

/**
 * The button *is* the progress indicator, and it is the gate: it only opens
 * once everything behind it has loaded, because pressing it drops the user
 * straight into the message field, ready to type.
 *
 * The fill and the status line are driven by `state` alone, so a future Altcha
 * check or an overload queue is a new state — not a new component.
 */
export const HandoverGateButton = ({
	state,
	onEnter
}: HandoverGateButtonProps) => {
	const { t } = useTranslation();
	const open = GATE_IS_OPEN[state];

	return (
		<ButtonBase
			onClick={open ? onEnter : undefined}
			disabled={!open}
			data-cy="handover-gate-button"
			data-cy-state={state}
			sx={{
				'position': 'relative',
				'width': '100%',
				'height': 60,
				'borderRadius': '30px',
				'overflow': 'hidden',
				'bgcolor': registrationMd3.primary,
				'color': registrationMd3.onPrimary,
				'boxShadow': `0 6px 0 0 ${registrationMd3.primaryDark}`,
				'display': 'flex',
				'alignItems': 'center',
				'justifyContent': 'space-between',
				'pl': 3,
				'pr': 1,
				'textAlign': 'left',
				// Disabled here means "not yet", not "unavailable": the button
				// keeps its brand colour and stays legible, it just does not
				// respond. Greying it out would read as an error.
				'&.Mui-disabled': {
					color: registrationMd3.onPrimary,
					opacity: 0.92
				},
				'&:active': open
					? {
							boxShadow: `0 2px 0 0 ${registrationMd3.primaryDark}`,
							transform: 'translateY(4px)'
						}
					: undefined,
				'@media (prefers-reduced-motion: reduce)': {
					'&:active': { transform: 'none' }
				}
			}}
		>
			<Box
				aria-hidden
				sx={{
					position: 'absolute',
					left: 0,
					top: 0,
					bottom: 0,
					width: `${GATE_PROGRESS[state]}%`,
					bgcolor: 'rgba(255, 255, 255, 0.16)',
					transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
					'@media (prefers-reduced-motion: reduce)': {
						transition: 'none'
					}
				}}
			/>
			<Box
				sx={{
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					minWidth: 0
				}}
			>
				<Typography
					component="span"
					sx={{
						fontSize: 17,
						fontWeight: 700,
						lineHeight: '22px',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis'
					}}
				>
					{t(
						'registration.handover.cta',
						'Anfrage schreiben'
					)}
				</Typography>
				<Typography
					component="span"
					role="status"
					aria-live="polite"
					sx={{
						fontSize: 12,
						lineHeight: '16px',
						opacity: 0.92,
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis'
					}}
				>
					{t(GATE_STATUS_KEY[state], GATE_STATUS_FALLBACK[state])}
				</Typography>
			</Box>
			<Box
				component="span"
				aria-hidden
				sx={{
					position: 'relative',
					width: 44,
					height: 44,
					flexShrink: 0,
					ml: 1,
					borderRadius: '50%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					bgcolor: open ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
					transition: 'background-color 300ms ease',
					'@media (prefers-reduced-motion: reduce)': {
						transition: 'none'
					}
				}}
			>
				<ArrowForwardRoundedIcon />
			</Box>
		</ButtonBase>
	);
};
