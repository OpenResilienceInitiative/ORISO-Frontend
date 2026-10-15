/**
 * The stage effects were drawn in red: dark red dots, rosé lines, salmon glow.
 * Those literals ignored the tenant's primary colour, so a blue primary still
 * showed red dots on the stage. `createStageTint` keeps each literal's
 * lightness and saturation and moves only its hue onto the primary, so red
 * stays exactly as drawn and any other primary gets the same picture in its
 * own colour.
 */

/** The primary the literals were drawn for (#c0121f). */
const DRAWN_FOR: Rgb = [192, 18, 31];

type Rgb = [number, number, number];

/** `rgba(r,g,b,a)` for a colour drawn in the default red. */
export type StageTint = (r: number, g: number, b: number, a?: number) => string;

const parseColor = (value: string): Rgb | null => {
	const text = value.trim();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
	if (hex) {
		const digits =
			hex[1].length === 3
				? hex[1]
						.split('')
						.map((char) => char + char)
						.join('')
				: hex[1];
		const n = parseInt(digits, 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(text);
	return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
};

const toHsl = ([r, g, b]: Rgb): [number, number, number] => {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) {
		return [0, 0, l];
	}
	const s = d / (1 - Math.abs(2 * l - 1));
	let h: number;
	if (max === rn) {
		h = ((gn - bn) / d + 6) % 6;
	} else if (max === gn) {
		h = (bn - rn) / d + 2;
	} else {
		h = (rn - gn) / d + 4;
	}
	return [h * 60, s, l];
};

const fromHsl = (h: number, s: number, l: number): Rgb => {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const sector = Math.floor((((h % 360) + 360) % 360) / 60);
	const [r, g, b] = [
		[c, x, 0],
		[x, c, 0],
		[0, c, x],
		[0, x, c],
		[x, 0, c],
		[c, 0, x]
	][sector];
	return [r + m, g + m, b + m].map((v) => Math.round(v * 255)) as Rgb;
};

const identity: StageTint = (r, g, b, a = 1) =>
	`rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Number(a.toFixed(3))})`;

/** Reads `--m3-primary` from the element and returns the matching tint. */
export const createStageTint = (element: Element): StageTint => {
	const primary = parseColor(
		getComputedStyle(element).getPropertyValue('--m3-primary')
	);
	if (!primary) {
		return identity;
	}
	const shift = toHsl(primary)[0] - toHsl(DRAWN_FOR)[0];
	if (Math.abs(shift) < 1) {
		return identity;
	}
	return (r, g, b, a = 1) => {
		const [h, s, l] = toHsl([r, g, b]);
		const [nr, ng, nb] = fromHsl(h + shift, s, l);
		return identity(nr, ng, nb, a);
	};
};
