/**
 * "Clock made of clocks" digit encoding for the waiting-area countdown.
 *
 * Ported verbatim from the ORISO Design mockup (Wartebereich Countdown.dc.html,
 * itself adapted from the "Clock made of clocks" CodePen). Each digit is a 4×6
 * grid of 24 mini-clocks; every mini-clock's two hands point at preset angles
 * that together draw the digit's strokes. Keeping this as pure data makes it
 * unit-testable and keeps the renderer dumb.
 */
export interface HandAngles {
	/** hour-hand angle in degrees */
	h: number;
	/** minute-hand angle in degrees */
	m: number;
}

/** The seven stroke states a single mini-clock can take. */
export const CELL = {
	HH: { h: 0, m: 180 }, // horizontal bar (both hands flat)
	V: { h: 270, m: 90 }, // vertical bar
	TL: { h: 180, m: 270 }, // top-left elbow
	TR: { h: 0, m: 270 }, // top-right elbow
	BL: { h: 180, m: 90 }, // bottom-left elbow
	BR: { h: 0, m: 90 }, // bottom-right elbow
	E: { h: 135, m: 135 } // empty — both hands overlap on the same diagonal
} as const;

const { HH, V, TL, TR, BL, BR, E } = CELL;

/** DIGITS[d] = the 24 mini-clocks (row-major, 4 cols × 6 rows) drawing digit d. */
export const DIGITS: HandAngles[][] = [
	[
		BR,
		HH,
		HH,
		BL,
		V,
		BR,
		BL,
		V,
		V,
		V,
		V,
		V,
		V,
		V,
		V,
		V,
		V,
		TR,
		TL,
		V,
		TR,
		HH,
		HH,
		TL
	], // 0
	[
		BR,
		HH,
		BL,
		E,
		TR,
		BL,
		V,
		E,
		E,
		V,
		V,
		E,
		E,
		V,
		V,
		E,
		BR,
		TL,
		TR,
		BL,
		TR,
		HH,
		HH,
		TL
	], // 1
	[
		BR,
		HH,
		HH,
		BL,
		TR,
		HH,
		BL,
		V,
		BR,
		HH,
		TL,
		V,
		V,
		BR,
		HH,
		TL,
		V,
		TR,
		HH,
		BL,
		TR,
		HH,
		HH,
		TL
	], // 2
	[
		BR,
		HH,
		HH,
		BL,
		TR,
		HH,
		BL,
		V,
		E,
		BR,
		TL,
		V,
		E,
		TR,
		BL,
		V,
		BR,
		HH,
		TL,
		V,
		TR,
		HH,
		HH,
		TL
	], // 3
	[
		BR,
		BL,
		BR,
		BL,
		V,
		V,
		V,
		V,
		V,
		TR,
		TL,
		V,
		TR,
		HH,
		BL,
		V,
		E,
		E,
		V,
		V,
		E,
		E,
		TR,
		TL
	], // 4
	[
		BR,
		HH,
		HH,
		BL,
		V,
		BR,
		HH,
		TL,
		V,
		TR,
		HH,
		BL,
		TR,
		HH,
		BL,
		V,
		BR,
		HH,
		TL,
		V,
		TR,
		HH,
		HH,
		TL
	], // 5
	[
		BR,
		HH,
		HH,
		BL,
		V,
		BR,
		HH,
		TL,
		V,
		TR,
		HH,
		BL,
		V,
		BR,
		BL,
		V,
		V,
		TR,
		TL,
		V,
		TR,
		HH,
		HH,
		TL
	], // 6
	[
		BR,
		HH,
		HH,
		BL,
		TR,
		HH,
		BL,
		V,
		E,
		E,
		V,
		V,
		E,
		E,
		V,
		V,
		E,
		E,
		V,
		V,
		E,
		E,
		TR,
		TL
	], // 7
	[
		BR,
		HH,
		HH,
		BL,
		V,
		BR,
		BL,
		V,
		V,
		TR,
		TL,
		V,
		V,
		BR,
		BL,
		V,
		V,
		TR,
		TL,
		V,
		TR,
		HH,
		HH,
		TL
	], // 8
	[
		BR,
		HH,
		HH,
		BL,
		V,
		BR,
		BL,
		V,
		V,
		TR,
		TL,
		V,
		TR,
		HH,
		BL,
		V,
		BR,
		HH,
		TL,
		V,
		TR,
		HH,
		HH,
		TL
	] // 9
];

/** Cells for a single digit 0–9 (falls back to 0 for out-of-range input). */
export const digitCells = (d: number): HandAngles[] => DIGITS[d] ?? DIGITS[0];

/** Two-digit, zero-padded value as its two digit indices, e.g. 7 → [0, 7]. */
export const twoDigits = (value: number): [number, number] => {
	const v = Math.max(0, Math.floor(value));
	return [Math.floor(v / 10) % 10, v % 10];
};
