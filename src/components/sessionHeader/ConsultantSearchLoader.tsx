import * as React from 'react';
import clsx from 'clsx';
import './consultantSearchLoader.styles.scss';

interface ConsultantSearchLoaderProps {
	/** Edge length of the magnet's box. Defaults to the 24 px glyph slot. */
	size?: string;
	/**
	 * While `false` the magnet stands still and sends no beam — the same
	 * drawing serves as the static conversation-type glyph, so the two
	 * states are visibly one object rather than two icons (FE#1115).
	 */
	animated?: boolean;
	/**
	 * The beam paints outside the component's box by design, so it needs a
	 * host that does not clip. The session-list card does — its
	 * `overflow: hidden` is what rounds the card's own 24 px corners — so
	 * the row shows the sweep without the beam rather than a beam sliced
	 * off at the card's edge (FE#1115).
	 */
	showBeam?: boolean;
	className?: string;
}

/**
 * The magnet — the conversation-type glyph of an enquiry, and the
 * "we are looking for a counsellor for you" indicator.
 *
 * FE#1115: this used to be two separate hand-built drawings. The header
 * carried a static magnet inside the grey capsule and an animated one inside
 * a black disc next to it, each assembled from a bar with square corners on
 * one side. There is one drawing now, it lives inside the capsule, and its
 * beam is free to leave the capsule — which is the whole point of the beam.
 */
export const ConsultantSearchLoader: React.FC<ConsultantSearchLoaderProps> = ({
	size = '24px',
	animated = true,
	showBeam = true,
	className
}) => {
	return (
		<span
			className={clsx(
				'consultantSearchLoader',
				animated && 'consultantSearchLoader--animated',
				className
			)}
			style={{ '--csl-size': size } as React.CSSProperties}
			data-cy="consultant-search-loader"
			aria-hidden="true"
		>
			<span className="consultantSearchLoader__sweep">
				{animated && showBeam && (
					<>
						<span className="consultantSearchLoader__beam" />
						<span className="consultantSearchLoader__beam consultantSearchLoader__beam--trailing" />
					</>
				)}
				<span className="consultantSearchLoader__magnet">
					<span className="consultantSearchLoader__pole consultantSearchLoader__pole--left" />
					<span className="consultantSearchLoader__pole consultantSearchLoader__pole--right" />
				</span>
			</span>
		</span>
	);
};
