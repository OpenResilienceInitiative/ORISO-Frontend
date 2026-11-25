/**
 * Story check: every visible text in a subtree reaches WCAG AA against the
 * background it is actually painted on (P0 dark mode, 2026-11-25).
 *
 * Dark-mode regressions came from a fill that keeps its light tone in every
 * scheme (`--m3-*-fixed`, a hard-coded `#fff`) under ink that swaps with
 * the scheme (`--m3-on-surface`, `--m3-secondary`), or the other way round.
 * Token names alone cannot catch that; the painted colours can. Run this in
 * the dark-scheme story of a component so the pair is measured there.
 */

type Rgba = { r: number; g: number; b: number; a: number };

export type LowContrastText = {
	text: string;
	ratio: number;
	color: string;
	background: string;
	element: Element;
};

const channels = (list: string): number[] =>
	list
		.split(/[\s,/]+/)
		.filter(Boolean)
		.map((part) =>
			part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part)
		);

/**
 * Computed colours come as `rgb()`/`rgba()`, or as `color(srgb …)` once a
 * `color-mix(in srgb, …)` is involved. Anything else (another colour space)
 * is `null`, and callers report it instead of passing it.
 */
const parse = (value: string): Rgba | null => {
	const legacy = value.match(/^rgba?\(([^)]+)\)$/);
	if (legacy) {
		const parts = channels(legacy[1]);
		return {
			r: parts[0],
			g: parts[1],
			b: parts[2],
			a: parts.length > 3 ? parts[3] : 1
		};
	}
	const srgb = value.match(/^color\(srgb\s+([^)]+)\)$/);
	if (srgb) {
		const parts = channels(srgb[1]);
		return {
			r: parts[0] * 255,
			g: parts[1] * 255,
			b: parts[2] * 255,
			a: parts.length > 3 ? parts[3] : 1
		};
	}
	return null;
};

const isTransparent = (value: string): boolean =>
	value === 'transparent' || value === 'rgba(0, 0, 0, 0)';

const over = (top: Rgba, bottom: Rgba): Rgba => ({
	r: top.r * top.a + bottom.r * (1 - top.a),
	g: top.g * top.a + bottom.g * (1 - top.a),
	b: top.b * top.a + bottom.b * (1 - top.a),
	a: 1
});

const luminance = ({ r, g, b }: Rgba): number => {
	const channel = (value: number) => {
		const c = value / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const ratio = (a: Rgba, b: Rgba): number => {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
};

/**
 * The colour the element sits on: its own and its ancestors' fills, stacked.
 * `null` when one of those fills is in a colour format `parse` cannot read.
 */
const paintedBackground = (element: Element): Rgba | null => {
	const layers: Rgba[] = [];
	for (let node: Element | null = element; node; node = node.parentElement) {
		const value = getComputedStyle(node).backgroundColor;
		const fill = parse(value);
		if (!fill) {
			if (isTransparent(value)) {
				continue;
			}
			return null;
		}
		if (fill.a > 0) {
			layers.push(fill);
			if (fill.a >= 0.99) {
				break;
			}
		}
	}
	let painted: Rgba = parse(
		getComputedStyle(document.body).backgroundColor
	) ?? {
		r: 255,
		g: 255,
		b: 255,
		a: 1
	};
	if (painted.a < 0.99) {
		painted = { r: 255, g: 255, b: 255, a: 1 };
	}
	for (let index = layers.length - 1; index >= 0; index -= 1) {
		painted = over(layers[index], painted);
	}
	return painted;
};

const hasBackgroundImage = (element: Element): boolean => {
	for (let node: Element | null = element; node; node = node.parentElement) {
		const style = getComputedStyle(node);
		if (style.backgroundImage && style.backgroundImage !== 'none') {
			return true;
		}
		const fill = parse(style.backgroundColor);
		if (fill && fill.a >= 0.99) {
			return false;
		}
	}
	return false;
};

/** Opacity the element is painted with: its own times its ancestors'. */
const effectiveOpacity = (element: Element): number => {
	let opacity = 1;
	for (let node: Element | null = element; node; node = node.parentElement) {
		opacity *= Number(getComputedStyle(node).opacity);
	}
	return opacity;
};

const NON_TEXT_INPUTS = new Set([
	'checkbox',
	'radio',
	'range',
	'color',
	'file',
	'hidden',
	'image',
	'button',
	'submit',
	'reset'
]);

/**
 * The text a form field shows: its value, or else its placeholder (which
 * is drawn in the `::placeholder` colour). `null` for anything else.
 */
const fieldText = (
	element: Element
): { text: string; placeholder: boolean } | null => {
	if (
		!(element instanceof HTMLInputElement) &&
		!(element instanceof HTMLTextAreaElement)
	) {
		return null;
	}
	if (
		element instanceof HTMLInputElement &&
		NON_TEXT_INPUTS.has(element.type)
	) {
		return null;
	}
	if (element.value.trim().length > 0) {
		return { text: element.value, placeholder: false };
	}
	if (element.placeholder.trim().length > 0) {
		return { text: element.placeholder, placeholder: true };
	}
	return null;
};

const hasOwnText = (element: Element): boolean =>
	fieldText(element) !== null ||
	Array.from(element.childNodes).some(
		(node) =>
			node.nodeType === Node.TEXT_NODE &&
			(node.textContent ?? '').trim().length > 0
	);

const isMeasurable = (element: Element): boolean => {
	if (
		element.closest(
			'[disabled], [aria-disabled="true"], [aria-hidden="true"], .Mui-disabled'
		)
	) {
		return false;
	}
	if (!hasOwnText(element)) {
		return false;
	}
	const box = element.getBoundingClientRect();
	if (box.width < 2 || box.height < 2) {
		return false;
	}
	const style = getComputedStyle(element);
	if (style.visibility === 'hidden' || effectiveOpacity(element) === 0) {
		return false;
	}
	// Hatched and gradient fills have no single colour to score against.
	return !hasBackgroundImage(element);
};

/** The colour the element's text is drawn in (`::placeholder` for a placeholder). */
const inkValue = (element: Element): string =>
	fieldText(element)?.placeholder
		? getComputedStyle(element, '::placeholder').color
		: getComputedStyle(element).color;

/**
 * Contrast of the element's ink against what it sits on. The ink is
 * composited with the element's effective opacity (its own and its
 * ancestors'), so faded text is scored as it is painted. `null` when a
 * colour is in a format `parse` cannot read.
 */
const measure = (
	element: Element
): { ratio: number; color: string; background: Rgba } | null => {
	const background = paintedBackground(element);
	const color = inkValue(element);
	const ink = parse(color);
	if (!background || !ink) {
		return null;
	}
	const painted = over(
		{ ...ink, a: ink.a * effectiveOpacity(element) },
		background
	);
	return {
		// Unrounded: WCAG compares the exact ratio (4.497 must not pass 4.5).
		ratio: ratio(painted, background),
		color,
		background
	};
};

const label = (element: Element): string =>
	(fieldText(element)?.text ?? element.textContent ?? '').trim().slice(0, 40);

/**
 * Visible texts under `root` (root included) that miss `minimum` (AA body
 * text: 4.5). A text whose colours cannot be read is reported with ratio 0
 * and `background: 'unsupported colour'`, never passed silently.
 */
export const findLowContrastText = (
	root: Element,
	minimum = 4.5
): LowContrastText[] =>
	[root, ...Array.from(root.querySelectorAll('*'))]
		.filter(isMeasurable)
		.map((element): LowContrastText => {
			const result = measure(element);
			if (!result) {
				return {
					text: label(element),
					ratio: 0,
					color: inkValue(element),
					background: 'unsupported colour',
					element
				};
			}
			const { background } = result;
			return {
				text: label(element),
				ratio: result.ratio,
				color: result.color,
				background: `rgb(${Math.round(background.r)}, ${Math.round(
					background.g
				)}, ${Math.round(background.b)})`,
				element
			};
		})
		.filter((entry) => entry.ratio < minimum);

/** Readable summary for a failing expectation. */
export const describeLowContrast = (entries: LowContrastText[]): string[] =>
	entries.map(
		({ text, ratio: value, color, background, element }) =>
			`"${text}" ${Math.floor(value * 100) / 100}:1 (${color} on ${background}) in ${element.tagName.toLowerCase()}.${Array.from(element.classList).slice(0, 2).join('.')}`
	);

/**
 * Contrast of an element's own `color` (text or currentColor icon) against
 * what it sits on, opacity included; 0 when a colour cannot be read.
 */
export const paintedContrast = (element: Element): number =>
	measure(element)?.ratio ?? 0;
