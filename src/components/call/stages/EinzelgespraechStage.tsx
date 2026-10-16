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
					style={{ background: participants[1].avatar.bg }}
				/>
				<div
					data-testid="half"
					data-side="first"
					className={styles.half}
					style={{
						background: participants[0].avatar.bg,
						clipPath: `url(#${seamId})`,
						transition: `clip-path ${SEAM_EASING}`
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
									transition: `inset-inline-start ${SEAM_EASING}`
								}}
							>
								<AnimalAvatar
									avatar={p.avatar}
									size={Math.round(size * 0.22)}
									outline={false}
								/>
							</span>
						</React.Fragment>
					);
				})}
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
