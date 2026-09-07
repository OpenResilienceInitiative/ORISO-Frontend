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
import { useDeferredFlourish } from './useDeferredFlourish';

/** After this the gate opens regardless, labelled honestly as "taking longer". */
const SLOW_AFTER_MS = 20000;

export interface RegistrationHandoverProps {
	/** The real "everything behind the gate has loaded" signal (appReady). */
	ready: boolean;
	/** Called when the user opens the gate. Must land them in the message field. */
	onEnter: () => void;
	/** Test seam: force a gate state instead of deriving it from `ready`. */
	forcedState?: HandoverGateState;
	/**
	 * Where the screen lives.
	 *
	 * `overlay` (default) covers the viewport — `position: fixed` on the modal
	 * layer. That is what `AuthenticatedApp` needs: by then the registration
	 * page is gone and this screen *is* the page.
	 *
	 * `inline` fills the column it is placed in instead. Needed inside
	 * `StageLayout`, where the brand panel must stay visible beside it — an
	 * overlay would simply paint over the panel and leave
	 * `.stageLayout__content` at height 0 (ORISO-Frontend#1219).
	 */
	variant?: 'overlay' | 'inline';
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
		steps?: HandoverStep[];
	};
}

/**
 * Post-registration handover screen. Replaces the old progress-bar loader.
 *
 * While the app bootstraps, the user reads what happens next instead of
 * watching a bar. The button underneath is the gate: it only opens once
 * everything behind it is loaded, so the click lands them in a chat room they
 * can type into immediately.
 *
 * Loading priority (Frank, 2026-08-06):
 *   tier 1  this markup — no network, painted on the first frame
 *   tier 2  the three card motifs — lazy, boxes reserved, no reflow
 *   tier 3  decoration — see `useDeferredFlourish`, never before tiers 1–2
 */
export const RegistrationHandover = ({
	ready,
	onEnter,
	forcedState,
	variant = 'overlay',
	copy
}: RegistrationHandoverProps) => {
	const { t } = useTranslation();
	const [slow, setSlow] = useState(false);
	const [artworkSettled, setArtworkSettled] = useState(false);
	const [entering, setEntering] = useState(false);
	const enteredRef = useRef(false);

	useEffect(() => {
		const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
		return () => clearTimeout(timer);
	}, []);

	const state: HandoverGateState =
		forcedState ??
		(entering ? 'entering' : ready ? 'ready' : slow ? 'slow' : 'preparing');

	// Tier 3 waits for both: the content the user came for, and the app behind
	// the gate. Decoration must never compete with either.
	const flourish = useDeferredFlourish(artworkSettled && ready);
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
			data-cy-flourish={flourish ? 'on' : 'off'}
			sx={{
				...(variant === 'overlay'
					? {
							position: 'fixed',
							inset: 0,
							zIndex: (theme) => theme.zIndex.modal
						}
					: // Fill the column instead of the viewport, and stay in
						// flow so the surrounding StageLayout keeps its height.
						//
						// `minWidth: 0` is load-bearing: a flex item defaults to
						// `min-width: auto`, so without it the carousel's three
						// 250px cards force this box to ~814px and it overflows a
						// 390px column. The overlay variant never hit this because
						// `inset: 0` pinned its width to the viewport.
						{
							position: 'relative',
							flex: 1,
							minHeight: 0,
							minWidth: 0,
							width: '100%'
						}),
				display: 'flex',
				flexDirection: 'column',
				bgcolor: registrationMd3.surface,
				color: registrationMd3.onSurface,
				/* The overlay owns the viewport, so clipping is right there. The
				   inline variant sits in a column that is taller than the screen
				   on a phone (the mobile hero bar pushes it down), and clipping
				   would cut off the space reserved for the fixed gate bar — the
				   encryption line then sits behind it. Let it scroll instead,
				   exactly as the registration steps do. */
				overflow: variant === 'overlay' ? 'hidden' : 'visible'
			}}
		>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					width: '100%',
					/* 720 was too narrow from the first review on: three
					   264 px cards plus their two 20 px gaps need 832 of
					   content, and the column pads 40 a side — 912 in all. On
					   a 1440 screen the third card was cut off before (Frank,
					   turn 1: "das falsche Maß bei 1440"). Below `lg` it keeps
					   720 and the cards scroll, which is what a phone wants.

					   Only the overlay may take those 912: it owns the whole
					   viewport. The inline variant stands in the white column
					   beside the red stage, which is 60vw — 864 px at 1440 —
					   so a 912 module would run into the stage (Frank,
					   2026-09-07: "roter Bereich, Modul darf nie so breit
					   sein"). It keeps 720 and lets the cards scroll. */
					maxWidth:
						variant === 'overlay'
							? { xs: '100%', sm: 720, lg: 912 }
							: { xs: '100%', sm: 720 },
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
							{copy?.badge ??
								t('registration.handover.badge', 'Registriert')}
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
									? t(
											'registration.handover.headline',
											'Geschafft.'
										)
									: t(
											'registration.handover.headlineAlmost',
											'Fast geschafft.'
										);
							const shown = own ? done : done === handoverDone;
							if (own && !done) {
								return null;
							}
							return (
								<Typography
									key={String(done)}
									component={done ? 'h1' : 'span'}
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
						{copy?.subline ??
							t(
								'registration.handover.subline',
								'So geht es weiter:'
							)}
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
					<HandoverCarousel
						onArtworkSettled={() => setArtworkSettled(true)}
						steps={copy?.steps}
					/>
				</Box>

				<Box
					sx={{
						flex: 'none',
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: { xs: 'flex-start', sm: 'center' },
						gap: 1.25,
						py: { xs: 1.5, sm: 2 },
						/* The inline gate bar is fixed, so it reserves no space of
						   its own. Reserving it on the container would put the gap
						   at the container's bottom edge — which on a phone sits
						   below the fold, so the line still ended up behind the
						   bar. Reserving it here works inside the flex
						   distribution: the carousel gives up the height and the
						   line moves up instead. */
						mb: variant === 'inline' ? '104px' : 0,
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
							t(
								'registration.handover.encryption',
								'Verschlüsselt: Nur Sie und die Mitarbeiterinnen Ihrer Beratungsstelle können Ihre Anfrage einsehen.'
							)}
					</Typography>
				</Box>
			</Box>

			<Box
				sx={{
					...(variant === 'inline'
						? /* Match the registration footer exactly — same fixed
						     bar the other steps use (`Registration.tsx`, the
						     `position: fixed` block). In flow it fell below the
						     fold on a phone: the bar started at y=836 in an
						     844px viewport, so the gate was simply not there. */
							{
								position: 'fixed',
								bottom: 0,
								right: 0,
								width: { xs: '100vw', lg: '60vw' },
								backgroundColor: 'rgba(255, 255, 255, 0.94)',
								backdropFilter: 'blur(8px)',
								zIndex: 65,
								pt: 1.25,
								pb: {
									xs: 'calc(12px + env(safe-area-inset-bottom))',
									sm: 1.75
								}
							}
						: {
								flex: 'none',
								bgcolor: '#fff',
								pt: 1.25,
								pb: 1.75
							}),
					borderTop: `1px solid ${registrationMd3.outlineVariant}`,
					px: { xs: 2, sm: 5 }
				}}
			>
				{/* Desktop: the gate is the registration button carrying on, so it
				    keeps that button's right edge (40px inset, same as `px`) and
				    grows leftwards out of it instead of appearing as a new
				    full-width bar. 196px is `RegistrationFooterPrimaryButton`'s
				    md `minWidth` — the width it is stretching *from*.
				    Mobile keeps the full-width bar: there the register button is
				    full width too, so there is nothing to stretch out of. */}
				<Box
					sx={{
						'width': '100%',
						'maxWidth': { xs: '100%', sm: 480 },
						'ml': { xs: 0, sm: 'auto' },
						'mr': 0,
						'@keyframes handoverGateStretch': {
							from: { maxWidth: '196px' },
							to: { maxWidth: '480px' }
						},
						/* Desktop only, and only where the stretch has something
						   to stretch out of. Animating `max-width` rather than
						   `width` keeps the mobile full-width case untouched —
						   animating `width` there resolved against the wrong box
						   and pushed the button off-screen. */
						'@media (min-width: 600px) and (prefers-reduced-motion: no-preference)':
							{
								animation:
									'handoverGateStretch 420ms cubic-bezier(0.4, 0, 0.2, 1)'
							}
					}}
				>
					<HandoverGateButton
						state={state}
						onEnter={handleEnter}
						label={copy?.cta}
					/>
				</Box>
			</Box>
		</Box>
	);
};
