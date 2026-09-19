import * as React from 'react';
import clsx from 'clsx';
import './consultantSearchLoader.styles.scss';

/** How long one search gesture takes. Mirrors `--csl-pulse` in the SCSS. */
const PULSE_MS = 2600;

interface ConsultantSearchLoaderProps {
	/** Edge length of the magnet's box. Defaults to the 24 px glyph slot. */
	size?: string;
	/**
	 * While `false` the magnet stands still and never sends — the same
	 * drawing serves as the static conversation-type glyph, so the two
	 * states are visibly one object rather than two icons (FE#1115).
	 */
	animated?: boolean;
	className?: string;
}

const prefersReducedMotion = () =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The magnet — the conversation-type glyph of an enquiry, and the
 * "we are looking for a counsellor for you" indicator.
 *
 * It sends once when the view arrives and again whenever the surface it
 * sits on is hovered, and is otherwise completely still. Frank, 15.09.:
 * "immer wenn wir drüber hovern, dann spielen wir einfach die Animation.
 * Das reicht. … wenn das Ticket reingeladen wird, natürlich beim ersten Mal
 * auch." That also settles the case he worried about earlier — three or
 * four waiting requests on one screen can no longer pulse in lockstep,
 * because nothing pulses on a timer at all.
 *
 * Hosts opt into the hover replay by carrying `consultantSearchLoaderHost`;
 * the hover target is then the whole capsule or card, not the 24 px glyph.
 *
 * FE#1115: this used to be two separate hand-built drawings. The header
 * carried a static magnet inside the grey capsule and an animated one
 * inside a black disc next to it, each assembled from a bar with square
 * corners on one side. There is one drawing now, it lives inside the
 * capsule, and its beam is free to leave it.
 */
export const ConsultantSearchLoader: React.FC<ConsultantSearchLoaderProps> = ({
	size = '24px',
	animated = true,
	className
}) => {
	const [hasArrived, setHasArrived] = React.useState(false);

	React.useEffect(() => {
		if (!animated || prefersReducedMotion()) {
			return undefined;
		}
		setHasArrived(true);
		// Dropped again once it has played, so a later hover starts a fresh
		// animation instead of restarting a still-running one.
		const timer = window.setTimeout(() => setHasArrived(false), PULSE_MS);
		return () => window.clearTimeout(timer);
	}, [animated]);

	return (
		<span
			className={clsx(
				'consultantSearchLoader',
				animated && 'consultantSearchLoader--animated',
				hasArrived && 'consultantSearchLoader--pulsing',
				className
			)}
			style={{ '--csl-size': size } as React.CSSProperties}
			data-cy="consultant-search-loader"
			aria-hidden="true"
		>
			<span className="consultantSearchLoader__sweep">
				{animated && (
					<>
						<span className="consultantSearchLoader__beam" />
						<span className="consultantSearchLoader__beam consultantSearchLoader__beam--second" />
						<span className="consultantSearchLoader__beam consultantSearchLoader__beam--third" />
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
