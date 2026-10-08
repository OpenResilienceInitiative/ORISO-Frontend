import * as React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import {
	GATE_IS_OPEN,
	GATE_PROGRESS,
	GATE_STATUS_KEY,
	HandoverGateState
} from './handoverGate';

export interface HandoverGateButtonProps {
	state: HandoverGateState;
	onEnter?: React.MouseEventHandler<HTMLButtonElement>;
	/** Registration completion stays owned by its containing form. */
	type?: 'button' | 'submit';
	disabled?: boolean;
	title?: string;
	testId?: string;
	/** Preserve the completion consumer's existing E2E target. */
	testingAttribute?: string;
	/** Already translated. Default: the registration's "Anfrage schreiben". */
	label?: string;
	/** Already translated status line. Default: the state's own line. */
	status?: string;
	/**
	 * Fill in percent, when the caller knows better than the state — the
	 * live-chat waiting room fills the button as the queue moves.
	 */
	progress?: number;
	/**
	 * A slow sweep across the whole bar instead of a fill that creeps to the
	 * right. Waiting for a free counsellor has no measurable progress — a bar
	 * that fills promises one (Frank, 2026-09-08: „irgendein Lebenszeichen
	 * von Warten"). The queue position is said in words beside it.
	 */
	indeterminate?: boolean;
	/** Replaces the arrow — a turning clock while the queue moves. */
	icon?: React.ReactNode;
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
	onEnter,
	label,
	status,
	progress,
	indeterminate = false,
	icon,
	type = 'button',
	disabled = false,
	title,
	testId,
	testingAttribute = 'handover-gate-button'
}: HandoverGateButtonProps) => {
	const { t } = useTranslation();
	const open = GATE_IS_OPEN[state] && !disabled;
	const statusLabel = status ?? t(GATE_STATUS_KEY[state]);

	return (
		<ButtonBase
			onClick={open ? onEnter : undefined}
			type={type}
			disabled={!open}
			aria-busy={state === 'entering'}
			title={title ?? label}
			data-testid={testId}
			data-cy={testingAttribute}
			data-cy-state={state}
			sx={{
				'position': 'relative',
				'width': '100%',
				'minHeight': 60,
				'py': 1,
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
				'&:focus-visible': {
					outline: `3px solid ${registrationMd3.focusLayer}`,
					outlineOffset: 2
				},
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
			{indeterminate ? (
				<Box
					aria-hidden
					sx={{
						'position': 'absolute',
						'inset': 0,
						'backgroundImage':
							'linear-gradient(100deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.20) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.20) 58%, rgba(255,255,255,0) 80%)',
						'backgroundSize': '220% 100%',
						'backgroundRepeat': 'no-repeat',
						'animation': 'handoverGateSweep 2.8s linear infinite',
						'@keyframes handoverGateSweep': {
							from: { backgroundPosition: '130% 0' },
							to: { backgroundPosition: '-30% 0' }
						},
						/* Still a lit bar, just no movement. */
						'@media (prefers-reduced-motion: reduce)': {
							animation: 'none',
							backgroundImage: 'none',
							bgcolor: 'rgba(255, 255, 255, 0.12)'
						}
					}}
				/>
			) : (
				<Box
					aria-hidden
					sx={{
						'position': 'absolute',
						'left': 0,
						'top': 0,
						'bottom': 0,
						'width': `${progress ?? GATE_PROGRESS[state]}%`,
						'bgcolor': 'rgba(255, 255, 255, 0.16)',
						'transition':
							'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
						'@media (prefers-reduced-motion: reduce)': {
							transition: 'none'
						}
					}}
				/>
			)}
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
						color: 'inherit',
						fontSize: 17,
						fontWeight: 700,
						lineHeight: '22px',
						whiteSpace: 'normal',
						overflowWrap: 'anywhere'
					}}
				>
					{label ?? t('registration.handover.cta')}
				</Typography>
				{statusLabel && (
					<Typography
						component="span"
						role="status"
						aria-live="polite"
						sx={{
							color: 'inherit',
							fontSize: 12,
							lineHeight: '16px',
							opacity: 0.92,
							whiteSpace: 'normal',
							overflowWrap: 'anywhere'
						}}
					>
						{statusLabel}
					</Typography>
				)}
			</Box>
			<Box
				component="span"
				aria-hidden
				sx={{
					'position': 'relative',
					'width': 44,
					'height': 44,
					'flexShrink': 0,
					'ml': 1,
					'borderRadius': '50%',
					'display': 'flex',
					'alignItems': 'center',
					'justifyContent': 'center',
					'bgcolor': open
						? 'rgba(255, 255, 255, 0.2)'
						: 'transparent',
					'transition': 'background-color 300ms ease',
					'@media (prefers-reduced-motion: reduce)': {
						transition: 'none'
					}
				}}
			>
				{icon ?? <ArrowForwardRoundedIcon />}
			</Box>
		</ButtonBase>
	);
};
