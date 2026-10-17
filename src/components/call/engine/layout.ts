/**
 * Layout engine for the ORISO call arrangements.
 *
 * PORTED VERBATIM from the design handoff's prototype
 * (`design/Dynamische Call-Ansichten.dc.html`, the `data-dc-script` block),
 * as Ticket 01 requires. The bodies below are the prototype's, unchanged; only
 * types and `export` were added around them.
 *
 * DO NOT "clean up" the constants — the golden angle 137.507764°, the initial
 * radius k = sqrt(0.7·box² / (π·Σw²)), the 240 relaxation passes, the 0.99
 * overlap padding, the 0.006 centre pull, the 2.6 speaker weight. The handoff
 * says why, and it is worth repeating because it has already been ignored once:
 *
 *   "Every one of those was tuned by eye against the real animal glyphs.
 *    They are the design."
 *   "Rewriting them from a description will produce something that looks
 *    broadly similar and feels wrong."
 *
 * That is exactly what happened in an earlier attempt: the functions were
 * reimplemented from the prose description, and the result looked plausible
 * and was wrong — round bubbles where the design has organic forms, shapes
 * overlapping at two participants, a different scatter function altogether.
 *
 * Pure by contract: no DOM, no React, no imports from the app. Everything is a
 * total function of its arguments, so the same room looks the same on every
 * client and the tests can pin it down.
 */

export interface Shape {
	/** CSS `border-radius`, eight values. */
	blob: string;
	/** Degrees, as a string with one decimal — the prototype's `toFixed(1)`. */
	tilt: string;
	wobble: number;
	quiet: number;
	jitter: [number, number];
}

export interface Placement {
	size: number;
	x: number;
	y: number;
	blob: string;
	tilt: string;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Cell extends Rect {
	/** Index into the list that was passed in. */
	i: number;
}

// Nobody gets a shape from a list of eight — every person gets their OWN,
// derived from their name, so "ruhiger Fuchs 432" always arrives as the same
// slightly lopsided form and no two people in a room look alike.
export function seeded(str: string): () => number {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return () => {
		h += 0x6d2b79f5;
		let t = h;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function ownShape(name: string): Shape {
	const rnd = seeded(name);
	// Eight independent radii: four horizontal, four vertical. Kept between
	// 32–68% so the form always stays round enough to hold a face.
	const v = Array.from({ length: 8 }, () => Math.round(26 + rnd() * 48));
	return {
		blob: `${v[0]}% ${v[1]}% ${v[2]}% ${v[3]}% / ${v[4]}% ${v[5]}% ${v[6]}% ${v[7]}%`,
		tilt: (rnd() * 22 - 11).toFixed(1),
		wobble: 0.8 + rnd() * 0.48,
		quiet: 0.68 + rnd() * 0.26,
		jitter: [rnd() * 2 - 1, rnd() * 2 - 1]
	};
}

// Where everyone stands AND how much room they take. Weight comes from who is
// speaking, so the whole field breathes when the turn passes on — the same
// behaviour that makes the subdivision view work, in a soft arrangement.
// Real packing, not a layout: the shapes are sized to fill the frame, then
// pushed apart until they just touch. Whoever speaks grows, and the growth
// physically displaces the others — they lose room to the person talking.
export function packShapes(
	names: readonly string[],
	box: number,
	weights: readonly number[]
): Placement[] {
	const n = names.length;
	const shapes = names.map(ownShape);
	const w = weights.map((x, i) => x * shapes[i].wobble);
	const areaSum = w.reduce((a, b) => a + b * b, 0);
	const k = Math.sqrt((0.7 * box * box) / (Math.PI * areaSum));
	const golden = 137.507764 * (Math.PI / 180);
	const pts = w.map((weight, i) => {
		const a = i * golden + shapes[i].jitter[0] * 0.3;
		const rr = box * 0.3 * Math.sqrt((i + 0.5) / n);
		return {
			x: box / 2 + rr * Math.cos(a),
			y: box / 2 + rr * Math.sin(a),
			r: k * weight
		};
	});
	// A touch of negative padding so they genuinely abut rather than hover apart.
	const pad = 0.99;
	for (let it = 0; it < 240; it++) {
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const a = pts[i],
					b = pts[j];
				const dx = b.x - a.x,
					dy = b.y - a.y;
				const d = Math.hypot(dx, dy) || 0.01;
				const min = (a.r + b.r) * pad;
				if (d < min) {
					const push = (min - d) / d;
					// The bigger shape holds its ground; the smaller one gives way.
					const sa = b.r / (a.r + b.r),
						sb = a.r / (a.r + b.r);
					a.x -= dx * push * sa;
					a.y -= dy * push * sa;
					b.x += dx * push * sb;
					b.y += dy * push * sb;
				}
			}
		}
		for (const p of pts) {
			p.x += (box / 2 - p.x) * 0.006;
			p.y += (box / 2 - p.y) * 0.006;
			p.x = Math.max(p.r + 3, Math.min(box - p.r - 3, p.x));
			p.y = Math.max(p.r + 3, Math.min(box - p.r - 3, p.y));
		}
	}
	return pts.map((p, i) => ({
		size: Math.round(p.r * 2),
		x: Math.round(p.x - p.r),
		y: Math.round(p.y - p.r),
		blob: shapes[i].blob,
		tilt: shapes[i].tilt
	}));
}

export function organicSpots(
	names: readonly string[],
	box: number,
	weights: readonly number[]
): Placement[] {
	const n = names.length;
	const golden = 137.507764 * (Math.PI / 180);
	// In a phyllotaxis the nearest-neighbour spacing is roughly the scale
	// constant c, so solve for the shape size that keeps neighbours just clear.
	// Fewer people therefore means everyone is genuinely bigger, and the whole
	// field re-settles the moment somebody joins or leaves.
	const shapes = names.map(ownShape);
	const w2 = weights.map((w, i) =>
		w >= 1 ? w : w > 0.7 ? w : shapes[i].quiet
	);
	const avgW = w2.reduce((a, b) => a + b, 0) / n;
	// Deliberately over-scaled: the shapes should crowd and just nudge each
	// other, the way a group actually stands together.
	const base = box / 2 / (0.44 + avgW * 0.86 * Math.sqrt(n - 0.1));
	const sizes = w2.map((w, i) => Math.round(base * w * shapes[i].wobble));
	const maxS = Math.max(...sizes);
	const c = (box / 2 - maxS * 0.48) / Math.sqrt(n - 1 + 0.9);
	return sizes.map((size, i) => {
		const r = c * Math.sqrt(i + 0.9);
		const a = i * golden + shapes[i].jitter[0] * 0.16;
		const jr = r + shapes[i].jitter[1] * Math.min(26, c * 0.2);
		return {
			size,
			x: Math.round(box / 2 + jr * Math.cos(a) - size / 2),
			y: Math.round(box / 2 + jr * Math.sin(a) - size / 2),
			blob: shapes[i].blob,
			tilt: shapes[i].tilt
		};
	});
}

// Recursive subdivision: one shape splits until everyone has a cell. The
// speaker's branch keeps the larger share, so the picture re-balances by itself.
export function splitCells(
	list: readonly number[],
	rect: Rect,
	speaker: number
): Cell[] {
	if (list.length === 1) return [{ i: list[0], ...rect }];
	const half = Math.ceil(list.length / 2);
	const a = list.slice(0, half),
		b = list.slice(half);
	// Weight-proportional, not a fixed 62/38: with a fixed ratio the speaker's
	// advantage was diluted away again by the even cuts inside their own branch.
	const wt = (arr: readonly number[]) =>
		arr.reduce((t, i) => t + (i === speaker ? 2.6 : 1), 0);
	const ratio = wt(a) / (wt(a) + wt(b));
	const horiz = rect.w >= rect.h;
	const cut = Math.round((horiz ? rect.w : rect.h) * ratio);
	const r1 = horiz ? { ...rect, w: cut } : { ...rect, h: cut };
	const r2 = horiz
		? { ...rect, x: rect.x + cut, w: rect.w - cut }
		: { ...rect, y: rect.y + cut, h: rect.h - cut };
	return splitCells(a, r1, speaker).concat(splitCells(b, r2, speaker));
}
