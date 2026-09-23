import * as React from 'react';
import clsx from 'clsx';
import { useMediaQuery } from '@mui/material';
import './consultantSearchLoader.styles.scss';

interface ConsultantSearchLoaderProps {
	/** Edge length of the magnet's box. Defaults to the 24 px glyph slot. */
	size?: string;
	/** `false`: the still enquiry glyph — the same drawing, never sending. */
	animated?: boolean;
	className?: string;
}

/**
 * The enquiry glyph and "looking for a counsellor" indicator. Sends on arrival and on
 * hover of a `consultantSearchLoaderHost`, never on a timer, so requests never pulse in lockstep.
 */
export const ConsultantSearchLoader: React.FC<ConsultantSearchLoaderProps> = ({
	size = '24px',
	animated = true,
	className
}) => {
	const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const [hasArrived, setHasArrived] = React.useState(false);

	React.useEffect(() => {
		setHasArrived(animated && !reducedMotion);
	}, [animated, reducedMotion]);

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
			<span
				className="consultantSearchLoader__sweep"
				// Dropped once played, so a later hover starts a fresh sweep.
				onAnimationEnd={(event) => {
					if (event.target === event.currentTarget)
						setHasArrived(false);
				}}
			>
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
