import * as React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useTranslation } from 'react-i18next';
import { warmClosingDestination, warmWhenIdle } from '../appChunks';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { ClosingFocal } from '../../transition/closing/closingFocal';
import { ClosingSwapResult } from '../../transition/closing/playClosingAnimation';
import { useClosingAnimation } from '../../transition/closing/useClosingAnimation';
import {
	GATE_IS_OPEN,
	GATE_PROGRESS,
	GATE_STATUS_KEY,
	HandoverGateState
} from './handoverGate';

export interface HandoverGateButtonProps {
	state: HandoverGateState;
	/**
	 * What entering does. With `closing`, it runs once the screen is covered,
	 * and a promise it returns keeps the screen covered until it settles (the
	 * live-chat room saves its consent, then replaces the whole page). `false`,
	 * or a promise of it, says the entry was refused or failed and the person
	 * stays, so the room is given back without waiting for a destination.
	 */
	onEnter?: (event: React.MouseEvent<HTMLButtonElement>) => ClosingSwapResult;
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
	/**
	 * Where the person arrives after this button: the room declares it and the
	 * platform's closing animation plays on the way (ORISO-Frontend#1737). The
	 * button is `entering` from the press on, `onEnter` runs once the screen is
	 * covered, and the animation ends on this focal point. Omit it for buttons
	 * that do not leave the room, such as the registration form's submit.
	 */
	closing?: ClosingFocal;
	/**
	 * Asked before anything starts; `false` keeps the person where they are, no
	 * animation, no `onEnter`. The live-chat room refuses here when consent is
	 * missing, so the curtain never closes on a screen that then says "no".
	 * Asked again, as the room is by then, when the screen is covered.
	 */
	beforeEnter?: () => boolean;
	/**
	 * The button element, for a second way to press it: the live-chat dialog's
	 * "start chat" goes through the same gate, consent and closing animation
	 * included.
	 */
	buttonRef?: React.Ref<HTMLButtonElement>;
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
	testingAttribute = 'handover-gate-button',
	closing,
	beforeEnter,
	buttonRef
}: HandoverGateButtonProps) => {
	const { t } = useTranslation();
	const { play } = useClosingAnimation();
	const [closingBusy, setClosingBusy] = React.useState(false);
	/* The screen takes a moment to cover, and the overlay lets every pointer
	   through: what the room says then counts, not what it said at the press. */
	const room = React.useRef({ beforeEnter, onEnter });
	React.useEffect(() => {
		room.current = { beforeEnter, onEnter };
	}, [beforeEnter, onEnter]);
	/* The button is shut while the screen is covered, and a browser ignores
	   focus on a shut button: whoever pressed it with the keyboard gets it back
	   here, once it is open again and nobody else has taken the focus. */
	const keyboardOn = React.useRef<HTMLButtonElement | null>(null);
	React.useEffect(() => {
		const pressed = keyboardOn.current;
		if (closingBusy || !pressed) {
			return;
		}
		keyboardOn.current = null;
		const active = document.activeElement;
		if (
			pressed.isConnected &&
			!pressed.disabled &&
			(!active || active === document.body)
		) {
			pressed.focus({ preventScroll: true });
		}
	}, [closingBusy]);
	/* The screen behind the button is fetched while the person reads, so the
	   click lands on a screen that is already loaded. */
	React.useEffect(
		() =>
			closing
				? warmWhenIdle(() => warmClosingDestination(closing))
				: undefined,
		[closing]
	);
	const shownState: HandoverGateState = closingBusy ? 'entering' : state;
	const open = GATE_IS_OPEN[shownState] && !disabled;
	const statusLabel = status ?? t(GATE_STATUS_KEY[shownState]);

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (!open) {
			return;
		}
		if (beforeEnter && !beforeEnter()) {
			return;
		}
		if (!closing) {
			onEnter?.(event);
			return;
		}
		// Already warm in nearly every case; if not, the download starts now and
		// has the cover (340 ms) before the room is swapped.
		warmClosingDestination(closing);
		setClosingBusy(true);
		// A mouse click has a count; a key press or a script (the live-chat
		// leave dialog presses this button for the person) has none.
		keyboardOn.current =
			document.activeElement === event.currentTarget || event.detail === 0
				? event.currentTarget
				: null;
		const rect = event.currentTarget.getBoundingClientRect();
		void play({
			focal: closing,
			origin: {
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			},
			onCovered: () => {
				const { beforeEnter: stillAgrees, onEnter: enter } =
					room.current;
				if (stillAgrees && !stillAgrees()) {
					return false;
				}
				return enter?.(event);
			}
		})
			.catch((error) => console.error('Closing animation failed', error))
			.finally(() => {
				setClosingBusy(false);
			});
	};

	return (
		<ButtonBase
			ref={buttonRef}
			onClick={open ? handleClick : undefined}
			type={type}
			disabled={!open}
			aria-busy={shownState === 'entering'}
			title={title ?? label}
			data-testid={testId}
			data-cy={testingAttribute}
			data-cy-state={shownState}
			data-cy-closing={closing}
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
						'width': `${progress ?? GATE_PROGRESS[shownState]}%`,
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
