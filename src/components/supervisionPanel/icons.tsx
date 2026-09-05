/**
 * Inline glyphs for the supervision panel family. Kept local so the
 * presentational layer has no dependency on the SVGR pipeline (the vitest
 * `unit` project stubs `.svg` imports). Swap for catalogue icons in B2 if
 * the icon catalogue gains a grip glyph.
 */
import * as React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const base: IconProps = {
	'width': 20,
	'height': 20,
	'viewBox': '0 0 24 24',
	'fill': 'currentColor',
	'aria-hidden': true,
	'focusable': false
};

/** Six-dot grip — the universal "you can drag this" affordance. */
export const GripIcon = (props: IconProps) => (
	<svg {...base} {...props}>
		<circle cx="9" cy="6" r="1.6" />
		<circle cx="15" cy="6" r="1.6" />
		<circle cx="9" cy="12" r="1.6" />
		<circle cx="15" cy="12" r="1.6" />
		<circle cx="9" cy="18" r="1.6" />
		<circle cx="15" cy="18" r="1.6" />
	</svg>
);

export const CloseIcon = (props: IconProps) => (
	<svg {...base} {...props}>
		<path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
	</svg>
);

/** Downward chevron: "collapse into the miniature". */
export const CollapseIcon = (props: IconProps) => (
	<svg {...base} {...props}>
		<path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
	</svg>
);

/** Two overlapping bubbles: the supervision side conversation. */
export const SupervisionIcon = (props: IconProps) => (
	<svg {...base} {...props}>
		<path d="M4 4h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h-2zm4 1.99H4V6h4zm12 3.01a2 2 0 0 1 2 2v8l-3.5-2.5H10a2 2 0 0 1-2-2v-.5h7a4 4 0 0 0 4-4V9z" />
	</svg>
);

/** Reply arrow: a message thread. */
export const ThreadIcon = (props: IconProps) => (
	<svg {...base} {...props}>
		<path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
	</svg>
);
