import * as React from 'react';

import { AnimalAvatar, liftFor } from '../../pseudonym/AnimalAvatar';
import { NamePill } from '../atoms/NamePill';
import { type AtmosphereName, Atmosphere } from '../atmosphere/Atmosphere';
import { type CallParticipant } from './HainStage';
import {
	SEAM_EASING,
	type Speaking,
	seamFor,
	shareFor
} from './einzelgespraech';
import styles from './einzelgespraechStage.module.scss';

export interface EinzelgespraechStageProps {
	/** Exactly two: the advice seeker and the counsellor, in that order. */
	participants: readonly [CallParticipant, CallParticipant];
	size: number;
	atmosphere?: AtmosphereName;
}

/**
 * How far the quiet side steps back while the other one talks.
 *
 * The handoff's own value. Not a disabled state — 70% is still clearly
 * present, which matters in a counselling call where the quiet person has
 * not left the room.
 */
export const QUIET_DIM = 0.7;

const whoIsSpeaking = (
	participants: readonly [CallParticipant, CallParticipant]
): Speaking => {
	const [a, b] = participants;
	if (a.speaking && b.speaking) return 'both';
	if (a.speaking) return 'first';
	if (b.speaking) return 'second';
	return 'none';
};

/**
 * Einzelgespräch (2b) — one circle, two halves, a soft seam.
 *
 * The most common ORISO call by far: one person seeking advice, one
 * counsellor. The speaking half grows past half and the seam bows into the
 * quiet side, so the change reads as one body pressing against another rather
 * than as a bar filling up. Silence is an even split — see
 * `einzelgespraech.ts` for why that matters more than it sounds.
 *
 * The motion is a CSS transition over two numbers, not an animation loop.
 * Nothing here runs per frame.
 */
export const EinzelgespraechStage: React.FC<EinzelgespraechStageProps> = ({
	participants,
	size,
	atmosphere
}) => {
	const speaking = whoIsSpeaking(participants);
	const share = shareFor(speaking);
	const bow = seamFor(share);

	// The seam is an SVG path in objectBoundingBox units, not a CSS
	// clip-path shape. `ellipse()` cannot bow into the quiet side: its edge is
	// always convex the same way, and the first attempt at it swallowed
	// almost the whole circle — the quiet half became a sliver and its animal
	// vanished. A quadratic curve says exactly what the ticket describes.
	const seamId = React.useId().replace(/:/g, '');
	const tip = share + bow;
	// In px, not a percentage. `block-size: 86%` resolved against a grid row
	// sized by its own content, so the height collapsed and the circle came
	// out a flat ellipse — two to one.
	const circle = Math.round(size * 0.86);

	return (
		<div
			data-testid="einzelgespraech-stage"
			data-speaking={speaking}
			className={styles.stage}
			style={{ inlineSize: size, blockSize: size }}
		>
			{atmosphere !== undefined && <Atmosphere palette={atmosphere} />}

			<svg width="0" height="0" aria-hidden="true">
				<defs>
					<clipPath id={seamId} clipPathUnits="objectBoundingBox">
						{/* Straight down the middle when the split is even;
						the control point pushes the curve into whoever is not
						speaking. */}
						<path
							d={`M0,0 L${share},0 Q${tip},0.5 ${share},1 L0,1 Z`}
						/>
					</clipPath>
					{/* The same seam, from the other side. The whole box
					minus the first half, by even-odd — so the rim light on
					the second side bows exactly where the seam does instead
					of being cut down the middle. */}
					<clipPath
						id={`${seamId}-rest`}
						clipPathUnits="objectBoundingBox"
						clipRule="evenodd"
					>
						<path
							clipRule="evenodd"
							d={`M0,0 L1,0 L1,1 L0,1 Z M0,0 L${share},0 Q${tip},0.5 ${share},1 L0,1 Z`}
						/>
					</clipPath>
				</defs>
			</svg>

			<div
				className={styles.circle}
				// One lift for the whole circle. Per half it would trace the
				// seam, which is the one line in this view that must read as
				// a boundary inside a body rather than an edge.
				style={{
					inlineSize: circle,
					blockSize: circle,
					boxShadow: liftFor(circle)
				}}
			>
				{/* The quiet side fills the whole circle; the speaking side is
				clipped on top of it. One curve, so the two can never part. */}
				<div
					data-testid="half"
					data-side="second"
					className={styles.half}
					style={{
						background: participants[1].avatar.bg,
						...(speaking === 'first' ? { opacity: QUIET_DIM } : {})
					}}
				/>
				<div
					data-testid="half"
					data-side="first"
					className={styles.half}
					style={{
						background: participants[0].avatar.bg,
						clipPath: `url(#${seamId})`,
						transition: `clip-path ${SEAM_EASING}`,
						...(speaking === 'second' ? { opacity: QUIET_DIM } : {})
					}}
				/>

				{participants.map((p, i) => {
					// Each animal and name stays centred in its OWN half, or
					// the quiet one drifts off the edge as the seam moves.
					const centre =
						i === 0 ? share / 2 : share + (1 - share) / 2;
					return (
						<React.Fragment key={p.name}>
							<span
								data-testid="animal"
								className={styles.animal}
								style={{
									insetInlineStart: `${centre * 100}%`,
									transition: `inset-inline-start ${SEAM_EASING}`,
									// The animal steps back with its own
									// side. In the handoff it is a child of
									// the half and dims with it; here they
									// are siblings, so it has to be said
									// twice.
									...((i === 0 && speaking === 'second') ||
									(i === 1 && speaking === 'first')
										? { opacity: QUIET_DIM }
										: {})
								}}
							>
								<AnimalAvatar
									avatar={p.avatar}
									size={Math.round(size * 0.22)}
									outline={false}
									// The half already carries this colour.
									filled={false}
								/>
							</span>
						</React.Fragment>
					);
				})}

				{/* The body.
				    Two radial gradients and two inset shadows, verbatim from
				    the handoff: a highlight from the upper left, a wash from
				    the lower right. It lies OVER the animals because the
				    shading is of the whole sphere including what is painted
				    on it — underneath them it would only tint the background
				    and the circle would stay a disc. */}
				<span
					className={styles.sphere}
					data-testid="sphere"
					style={{ pointerEvents: 'none' }}
				/>

				{/* The voice.
				    A rim light in ORISO red on whoever is speaking, clipped
				    by the seam so it bows where the seam bows rather than
				    being cut down the middle. In the prototype this
				    alternates on a nine-second demo timer; here it follows
				    the microphone. */}
				{(speaking === 'first' || speaking === 'second') && (
					<span
						className={styles.rim}
						data-testid="rim"
						data-side={speaking}
						style={{
							clipPath: `url(#${
								speaking === 'first' ? seamId : `${seamId}-rest`
							})`,
							transition: `clip-path ${SEAM_EASING}`,
							pointerEvents: 'none'
						}}
					/>
				)}
			</div>

			{/* Outside the circle's overflow, deliberately. Inside it, a name
			near the rim was sliced off by the clip — "Susanne P." lost its
			full stop and then its P. */}
			{participants.map((p, i) => {
				const centre = i === 0 ? share / 2 : share + (1 - share) / 2;
				return (
					<span
						key={`${p.name}-label`}
						className={styles.label}
						style={{
							insetInlineStart: `calc(50% + ${Math.round(
								(centre - 0.5) * circle
							)}px)`,
							insetBlockEnd: `calc(50% - ${Math.round(
								circle * 0.34
							)}px)`,
							transition: `inset-inline-start ${SEAM_EASING}`
						}}
					>
						<NamePill
							name={p.name}
							speaking={p.speaking}
							micOff={p.micOff}
							handRaisedForMs={p.handRaisedForMs}
							maxWidth={Math.round(size * 0.36)}
						/>
					</span>
				);
			})}
		</div>
	);
};
