import * as React from 'react';

// Imported for its side effect: the file registers <oriso-pond>.
import './pond.js';

/**
 * The presets the ported `pond.js` actually defines.
 *
 * Ticket 05 says ten — "six animated, two deliberately still ('Ruhe',
 * 'Düne'), two dark ('Nachtrot', 'Lagerfeuer')". The file ships eleven. The
 * list here is read off the file rather than off the ticket, because the file
 * is what renders; the discrepancy is recorded in the test.
 */
export const ATMOSPHERE_NAMES = [
	'teich',
	'fluss',
	'nebel',
	'glut',
	'lichtung',
	'strom',
	'nacht',
	'spirale',
	'lagerfeuer',
	'ruhe',
	'duene'
] as const;

export type AtmosphereName = (typeof ATMOSPHERE_NAMES)[number];

/** The handoff's default for a counselling stage. */
export const DEFAULT_ATMOSPHERE: AtmosphereName = 'fluss';

export const isAtmosphereName = (value: string): value is AtmosphereName =>
	(ATMOSPHERE_NAMES as readonly string[]).includes(value);

export interface AtmosphereProps {
	palette: AtmosphereName;
	className?: string;
}

/**
 * The living backdrop behind a call stage.
 *
 * A thin wrapper, on purpose. All the drawing is the prototype's and is not
 * ours to second-guess; this only puts the element on the page and keeps the
 * preset on its attribute.
 *
 * The preset changes by ATTRIBUTE, never by remounting. Remounting would tear
 * down the canvas and restart the clock, which reads as a jump — the element
 * watches `palette` precisely so it does not have to.
 *
 * Hidden from assistive technology: it carries no information whatsoever, and
 * announcing it would be noise between a counsellor and what they need.
 */
export const Atmosphere: React.FC<AtmosphereProps> = ({
	palette,
	className
}) => {
	const ref = React.useRef<HTMLElement>(null);

	// Set as an ATTRIBUTE, deliberately. React assigns properties on custom
	// elements, and `palette` on OrisoPond is a getter derived from the
	// attribute — assigning it throws. Going through setAttribute is also
	// what triggers `attributeChangedCallback`, which is how the element
	// swaps preset without restarting its clock.
	React.useEffect(() => {
		ref.current?.setAttribute('palette', palette);
	}, [palette]);

	return (
		<oriso-pond
			ref={ref}
			class={className}
			aria-hidden="true"
			style={{ position: 'absolute', inset: 0 }}
		/>
	);
};

/*
 * React 19 moved the JSX namespace onto the React module, so augmenting the
 * old global `JSX` no longer reaches the type checker.
 */
declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'oriso-pond': React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement>,
				HTMLElement
			> & {
				palette?: string;
				class?: string;
				ref?: React.Ref<HTMLElement>;
			};
		}
	}
}
