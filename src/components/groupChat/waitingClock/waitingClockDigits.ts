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

/**
 * The largest value the face can draw. Three digit cells is where the clock
 * stops growing: 999 minutes is more than sixteen hours late, and a fourth
 * cell would cost the other group half its size on a phone.
 */
export const FACE_MAX = 999;

const clampFace = (value: number) =>
	Math.min(FACE_MAX, Math.max(0, Math.floor(value)));

/**
 * How many digit cells `value` needs: two, or three from 100 up.
 *
 * The face used to clamp at 99 (#1293), so a group 140 minutes late drew "99"
 * while its own `role="timer"` label said 140 — the two disagreed again, just
 * one digit further out. It grows a third cell instead now, and the geometry
 * pays for it by choosing a smaller mini-clock (#1499).
 */
export const faceDigitCount = (value: number): number =>
	clampFace(value) > 99 ? 3 : 2;

/**
 * `value` as its digit indices, zero-padded to at least two cells:
 * 7 → [0, 7], 42 → [4, 2], 140 → [1, 4, 0].
 */
export const faceDigits = (value: number): number[] =>
	String(clampFace(value))
		.padStart(2, '0')
		.split('')
		.map((character) => Number(character));
