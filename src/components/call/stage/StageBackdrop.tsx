import * as React from 'react';

import {
	Atmosphere,
	DEFAULT_ATMOSPHERE,
	type AtmosphereName
} from '../atmosphere/Atmosphere';
import styles from './stageBackdrop.module.scss';

export interface CentreImage {
	readonly src: string;
}

export interface StageBackdropProps {
	/** The preset, used only when the centre has configured no image. */
	readonly atmosphere?: AtmosphereName;
	/**
	 * The counselling centre's own backdrop.
	 *
	 * Part of the carrier's configuration — "not by an individual counsellor
	 * and never by an advice seeker". It arrives here as a URL and nothing
	 * in this component can set it.
	 */
	readonly image?: CentreImage | null;
	readonly className?: string;
}

/**
 * The stage surface, ticket 05.
 *
 * Three layers in a fixed order, taken from the prototype rather than
 * reasoned out: the warm off-white base `rgb(252,249,249)`, then either the
 * centre's photograph or the atmosphere, then the scrim.
 *
 * "Precedence: centre image > atmosphere preset" is an either/or, not a
 * z-order. With a preset the pond multiplies over the surface; with the
 * centre's own image there is no pond at all, because a photograph under a
 * multiplying colour field is not the backdrop that centre uploaded.
 *
 * The scrim is always there. It is heavier at the top and bottom than in the
 * middle — `.34 / .1 at 40% / .4` — and that is not a gradient for its own
 * sake: the header sits in the top band and the control rail in the bottom
 * one, and both have to stay readable over a backdrop neither of them chose.
 */
export const StageBackdrop = ({
	atmosphere,
	image,
	className
}: StageBackdropProps) => (
	<div
		className={[styles.backdrop, className].filter(Boolean).join(' ')}
		data-testid="stage-backdrop"
		aria-hidden="true"
		// Decorative and behind everything: a click here belongs to the
		// stage, never to the surface.
		style={{ pointerEvents: 'none' }}
	>
		{image ? (
			<img
				className={styles.image}
				data-testid="stage-image"
				src={image.src}
				alt=""
			/>
		) : (
			<div className={styles.atmosphere}>
				<Atmosphere palette={atmosphere ?? DEFAULT_ATMOSPHERE} />
			</div>
		)}
		<div className={styles.scrim} data-testid="stage-scrim" />
	</div>
);
