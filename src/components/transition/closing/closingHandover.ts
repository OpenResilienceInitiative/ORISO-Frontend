import { transitionMotion } from '../transitionMotion';
import { CLOSING_FOCAL_SELECTOR, ClosingFocal } from './closingFocal';
import { CLOSING_VARIANTS, ClosingVariant } from './closingVariants';

/**
 * A waiting room that replaces the whole page (the live-chat room) takes its
 * closing animation with it. The old document leaves this note in
 * `sessionStorage` as it goes, and the next document picks it up once and plays
 * the reveal (ORISO-Frontend#1737). The note is trusted only while it is fresh
 * and well-formed: anything else would put a cover over a page nobody is
 * waiting for.
 */
export const CLOSING_HANDOVER_KEY = 'oriso.closingHandover.v1';

/** The tenant's two colours, read off the old document's palette. */
export interface ClosingHandoverColors {
	primary: string;
	primaryDark: string;
}

export interface ClosingHandover {
	variant: ClosingVariant;
	focal: ClosingFocal;
	/** Where the press happened, as a share of the viewport (0 to 1). */
	origin: { x: number; y: number };
	/**
	 * The new document starts before the tenant's palette has arrived, so the
	 * colours travel with the note. Absent when the tenant has none of its own.
	 */
	colors?: ClosingHandoverColors;
	/** When the old document let go of the cover, in milliseconds. */
	at: number;
}

/** Plain colour notations only: nothing that could carry a url or a second declaration. */
const COLOUR =
	/^(#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([0-9a-z\s.,%/+-]*\))$/i;
const MAX_COLOUR_LENGTH = 64;

const isColour = (value: unknown): value is string =>
	typeof value === 'string' &&
	value.length <= MAX_COLOUR_LENGTH &&
	COLOUR.test(value);

const isShare = (value: unknown): value is number =>
	typeof value === 'number' && value >= 0 && value <= 1;

const readColors = (value: unknown): ClosingHandoverColors | undefined => {
	const { primary, primaryDark } = (value ?? {}) as Record<string, unknown>;
	return isColour(primary) && isColour(primaryDark)
		? { primary, primaryDark }
		: undefined;
};

const parse = (raw: string, now: number): ClosingHandover | null => {
	let value: Record<string, unknown> | null;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (value === null) {
		return null;
	}
	const { variant, focal, origin, colors, at } = value;
	const point = (origin ?? {}) as Record<string, unknown>;
	if (
		!CLOSING_VARIANTS.includes(variant as ClosingVariant) ||
		!Object.keys(CLOSING_FOCAL_SELECTOR).includes(focal as string) ||
		!isShare(point.x) ||
		!isShare(point.y) ||
		typeof at !== 'number' ||
		!(Math.abs(now - at) <= transitionMotion.closing.capMs)
	) {
		return null;
	}
	const readable = readColors(colors);
	return {
		variant: variant as ClosingVariant,
		focal: focal as ClosingFocal,
		origin: { x: point.x, y: point.y },
		...(readable && { colors: readable }),
		at
	};
};

/** Best effort: a browser that refuses storage costs the reveal, never the page. */
export const leaveClosingHandover = (
	win: Window,
	handover: ClosingHandover
): void => {
	try {
		win.sessionStorage.setItem(
			CLOSING_HANDOVER_KEY,
			JSON.stringify(handover)
		);
	} catch {
		/* storage refused or full */
	}
};

/** Picks the note up and throws it away, so it plays once. */
export const takeClosingHandover = (
	win: Window,
	now: number = Date.now()
): ClosingHandover | null => {
	let raw: string | null;
	try {
		raw = win.sessionStorage.getItem(CLOSING_HANDOVER_KEY);
		if (raw === null) {
			return null;
		}
		win.sessionStorage.removeItem(CLOSING_HANDOVER_KEY);
	} catch {
		return null;
	}
	return parse(raw, now);
};
