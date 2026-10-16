import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import {
	registrationMd3,
	registrationMotion
} from '../../registration/registrationDesign/registrationDesign';
import { HandoverCarousel, HandoverStep } from './HandoverCarousel';
import { HandoverGateButton } from './HandoverGateButton';
import { HandoverGateState } from './handoverGate';
import { useHandoverProgress } from './handoverProgress';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';

/** After this the gate opens regardless, labelled honestly as "taking longer". */
const SLOW_AFTER_MS = 20000;

export interface RegistrationHandoverProps {
	/** The real "everything behind the gate has loaded" signal (appReady). */
	ready: boolean;
	/** Called when the user opens the gate. Must land them in the message field. */
	onEnter: () => void;
	/** Force a gate state instead of deriving it from `ready`. */
	forcedState?: HandoverGateState;
	/**
	 * Fill while waiting, 0–100. Defaults to the share of finished handover
	 * milestones (`handoverProgress`), so the bar moves when work finishes
	 * and never on a timer.
	 */
	progress?: number;
	/**
	 * The words and cards of another way in. All already translated; every
	 * one defaults to the registration's. The live-chat entry room passes
	 * its own so this screen is one module for every entry, not a copy per
	 * entry (Frank, 2026-09-05).
	 */
	copy?: {
		badge?: string;
		headline?: string;
		subline?: string;
		encryption?: string;
		cta?: string;
		/** The gate button's status line per state; unset states keep theirs. */
		status?: Partial<Record<HandoverGateState, string>>;
		steps?: HandoverStep[];
	};
}

/**
 * The waiting room between "Registrieren" and the message field.
 *
 * It always stands in the white column of a `StageLayout`, on both sides of
 * the document load that follows registration: `Registration` shows it from
 * the click on, `AuthenticatedApp` shows it again after the load, in the same
 * stage and at the same fill. To the person it is one screen (#1219). There is
 * no overlay variant any more — one painted over the whole viewport and lost
 * the red stage, which is the jump Frank saw on 2026-10-09.
 *
 * The button underneath is the gate: it opens once everything behind it is
 * loaded, so the click lands them in a room they can type into immediately.
 *
 * Loading priority (Frank, 2026-08-06): this markup paints on the first frame
 * without network; the card motifs are lazy with reserved boxes.
 */
export const RegistrationHandover = ({
	ready,
	onEnter,
	forcedState,
	progress,
	copy
}: RegistrationHandoverProps) => {
	const { t } = useTranslation();
	const milestoneProgress = useHandoverProgress();
	const [slow, setSlow] = useState(false);
	const [entering, setEntering] = useState(false);
	const enteredRef = useRef(false);

	useEffect(() => {
		const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
		return () => clearTimeout(timer);
	}, []);

	const state: HandoverGateState =
		forcedState ??
		(entering ? 'entering' : ready ? 'ready' : slow ? 'slow' : 'preparing');

	/* While waiting the fill is the real share of finished work; once the
	   gate opens the state's own 100 takes over. */
	const fill =
		state === 'preparing' || state === 'slow'
			? (progress ?? milestoneProgress)
			: undefined;
	/* "Fast" goes away exactly when the way on is free — the same moment the
	   gate button stops waiting. `forcedState` is a test seam, so it decides
	   here too. */
	const handoverDone = state === 'ready' || state === 'entering';

	const handleEnter = useCallback(() => {
		if (enteredRef.current) {
			return;
		}
		enteredRef.current = true;
		setEntering(true);
		onEnter();
	}, [onEnter]);

	return (
		<Box
			data-cy="registration-handover"
			data-cy-progress={fill ?? 100}
			sx={{
				/* Fill the column and stay in flow so the StageLayout keeps its
				   height. `minWidth: 0` is load-bearing: a flex item defaults to
				   `min-width: auto`, and the carousel's three 250px cards would
				   force this box to ~814px in a 390px column. */
				position: 'relative',
				flex: 1,
				minHeight: 0,
				minWidth: 0,
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				bgcolor: registrationMd3.surface,
				color: registrationMd3.onSurface,
				/* Taller than the screen on a phone (the hero bar pushes it
				   down): let it scroll like the registration steps do. */
				overflow: 'visible'
			}}
		>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					width: '100%',
					/* Fills the white column beside the stage, like the live-chat
					   waiting room, so every room shows the same full cards on a
					   desktop (Frank, 2026-10-15/16: proportions from the live
					   chat). It never exceeds its column. */
					maxWidth: '100%',
					mx: 'auto',
					px: { xs: 2.5, sm: 5 },
					pt: { xs: 3, sm: 4 },
					pb: 0
				}}
			>
				<Box sx={{ flex: 'none' }}>
					<Box
						component="span"
						data-cy="handover-badge"
						sx={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 1,
							height: 30,
							pl: 0.5,
							pr: 1.5,
							mb: 1.25,
							borderRadius: '15px',
							bgcolor: registrationMd3.surfaceContainer
						}}
					>
						<Box
							component="span"
							aria-hidden
							sx={{
								'width': 22,
								'height': 22,
								'borderRadius': '50%',
								'bgcolor': registrationMd3.primary,
								'color': registrationMd3.onPrimary,
								'display': 'flex',
								'alignItems': 'center',
								'justifyContent': 'center',
								'& svg': { fontSize: 14 }
							}}
						>
							<CheckRoundedIcon />
						</Box>
						<Typography
							component="span"
							sx={{
								fontSize: 12,
								fontWeight: 600,
								letterSpacing: '0.6px',
								textTransform: 'uppercase',
								color: registrationMd3.primary
							}}
						>
							{copy?.badge ?? t('registration.handover.badge')}
						</Typography>
					</Box>
					{/* Frank, 2026-09-01: "wir sollten aus dem 'Geschafft, so
					    geht es weiter' ein 'Fast geschafft' machen, das können
					    wir auch ein bisschen animieren und dann wenn 'Anfrage
					    schreiben' fertig ist, dann geht das 'Fast' eben da auch
					    weg und es ist geschafft."

					    Two headlines share one grid cell so the line never
					    jumps: while the app is still loading the "Fast" one is
					    up, and the moment the way on is free it hands over to
					    "Geschafft." Crossfading whole lines rather than
					    collapsing the word keeps German capitalisation right
					    ("Fast geschafft." → "Geschafft.", not "geschafft.").
					    A caller that hands in its own headline (the live chat
					    does) gets that one, unanimated. */}
					<Box
						sx={{
							display: 'grid',
							gridTemplateAreas: '"headline"',
							alignItems: 'start'
						}}
					>
						{[false, true].map((done) => {
							const own = copy?.headline;
							const text = own
								? own
								: done
									? t('registration.handover.headline')
									: t('registration.handover.headlineAlmost');
							const shown = own ? done : done === handoverDone;
							if (own && !done) {
								return null;
							}
							return (
								<Typography
									key={String(done)}
									/* The visible line is the heading,
									   whichever of the two it is: with the
									   `h1` pinned to "Geschafft." the page had
									   no heading at all while it waited. */
									component={shown ? 'h1' : 'span'}
									aria-hidden={!shown}
									sx={{
										// Same reason as the button labels:
										// Typography does not inherit the
										// surface colour.
										'color': 'inherit',
										'gridArea': 'headline',
										'fontSize': { xs: 30, sm: 34 },
										'lineHeight': {
											xs: '36px',
											sm: '41px'
										},
										'fontWeight': 700,
										'opacity': shown ? 1 : 0,
										'transform': shown
											? 'translateY(0)'
											: 'translateY(-6px)',
										'transition': `opacity ${registrationMotion.standard} ${registrationMotion.easeOut}, transform ${registrationMotion.standard} ${registrationMotion.easeOut}`,
										'pointerEvents': 'none',
										'@media (prefers-reduced-motion: reduce)':
											{
												transition: 'none',
												transform: 'none'
											}
									}}
								>
									{text}
								</Typography>
							);
						})}
					</Box>
					<Typography
						sx={{
							mt: 0.75,
							fontSize: { xs: 15, sm: 16 },
							lineHeight: { xs: '21px', sm: '22px' },
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{copy?.subline ?? t('registration.handover.subline')}
					</Typography>
				</Box>

				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						pt: { xs: 2.25, sm: 2.5 }
					}}
				>
					<HandoverCarousel steps={copy?.steps} />
				</Box>

				<Box
					sx={{
						flex: 'none',
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: { xs: 'flex-start', sm: 'center' },
						gap: 1.25,
						py: { xs: 1.5, sm: 2 },
						fontSize: { xs: 12, sm: 13 },
						lineHeight: { xs: '17px', sm: '18px' },
						color: registrationMd3.onSurfaceVariant,
						textAlign: { xs: 'left', sm: 'center' }
					}}
				>
					<LockOutlinedIcon
						aria-hidden
						sx={{ fontSize: 18, flexShrink: 0, mt: '1px' }}
					/>
					<Typography component="span" sx={{ fontSize: 'inherit' }}>
						{copy?.encryption ??
							t('registration.handover.encryption')}
					</Typography>
				</Box>
			</Box>

			{/* The same bar every registration-shaped screen uses, so the
			    button does not move by a pixel between "Registrieren" and
			    here. It reserves its own measured height in the flow. */}
			<RegistrationFooter>
				<Box sx={{ flex: '1 1 0', minWidth: 0 }}>
					<HandoverGateButton
						state={state}
						onEnter={handleEnter}
						label={copy?.cta}
						status={copy?.status?.[state]}
						progress={fill}
					/>
				</Box>
			</RegistrationFooter>
		</Box>
	);
};
