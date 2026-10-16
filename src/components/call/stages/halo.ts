/**
 * How speaking looks in the Hain.
 *
 * The prototype gives both states outright, and gives the reason beside
 * them:
 *
 *   "The halo takes the person's own colour, so speaking reads as
 *    'she lights up' rather than 'the system marked her red'."
 *
 * That is the design, and it is the part most likely to be refactored away:
 * one shared accent colour is the obvious simplification and it is exactly
 * wrong. Marking somebody in a system colour reads as a flag on them. Their
 * own colour brightening reads as them.
 */

/** A palette hex at an alpha. Anything unparseable passes through. */
export function tint(colour: string, alpha: number): string {
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
	if (!hex) return colour;

	const digits =
		hex[1].length === 3
			? hex[1]
					.split('')
					.map((d) => d + d)
					.join('')
			: hex[1];
	const value = parseInt(digits, 16);
	// eslint-disable-next-line no-bitwise
	const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The quiet shape. The prototype's value, which does not scale. */
export const QUIET_SHADOW = '0 2px 6px rgba(0, 0, 0, 0.1)';

/** How far the speaking shape rises out of the field, in px. */
export const HALO_LIFT_PX = 4;

/** Alpha of the tight ring, then of the wide glow. */
const RING_ALPHA = 0.18;
const GLOW_ALPHA = 0.5;

/**
 * The shadow stack for one shape.
 *
 * Three layers when speaking: a tight ring in the person's colour, a wide
 * glow in the same colour, and a deeper drop that puts the shape in front of
 * the others rather than merely brighter than them.
 */
export function haloFor(background: string, speaking: boolean): string {
	if (!speaking) return QUIET_SHADOW;
	return [
		`0 0 0 6px ${tint(background, RING_ALPHA)}`,
		`0 0 40px 12px ${tint(background, GLOW_ALPHA)}`,
		'0 22px 38px -10px rgba(0, 0, 0, 0.24)'
	].join(', ');
}
