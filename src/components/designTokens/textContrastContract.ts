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

const parse = (value: string): Rgba | null => {
	const match = value.match(/rgba?\(([^)]+)\)/);
	if (!match) {
		return null;
	}
	const parts = match[1]
		.split(/[\s,/]+/)
		.filter(Boolean)
		.map(Number);
	return {
		r: parts[0],
		g: parts[1],
		b: parts[2],
		a: parts.length > 3 ? parts[3] : 1
	};
};

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

/** The colour the element sits on: its own and its ancestors' fills, stacked. */
const paintedBackground = (element: Element): Rgba => {
	const layers: Rgba[] = [];
	for (let node: Element | null = element; node; node = node.parentElement) {
		const fill = parse(getComputedStyle(node).backgroundColor);
		if (fill && fill.a > 0) {
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

const isMeasurable = (element: Element): boolean => {
	if (
		element.closest(
			'[disabled], [aria-disabled="true"], [aria-hidden="true"], .Mui-disabled'
		)
	) {
		return false;
	}
	const ownText = Array.from(element.childNodes).some(
		(node) =>
			node.nodeType === Node.TEXT_NODE &&
			(node.textContent ?? '').trim().length > 0
	);
	if (!ownText) {
		return false;
	}
	const box = element.getBoundingClientRect();
	if (box.width < 2 || box.height < 2) {
		return false;
	}
	const style = getComputedStyle(element);
	if (style.visibility === 'hidden' || Number(style.opacity) === 0) {
		return false;
	}
	// Hatched and gradient fills have no single colour to score against.
	return !hasBackgroundImage(element);
};

/** Visible texts under `root` that miss `minimum` (AA body text: 4.5). */
export const findLowContrastText = (
	root: Element,
	minimum = 4.5
): LowContrastText[] =>
	Array.from(root.querySelectorAll('*'))
		.filter(isMeasurable)
		.map((element) => {
			const background = paintedBackground(element);
			const ink = parse(getComputedStyle(element).color);
			if (!ink) {
				return null;
			}
			const painted = over(ink, background);
			return {
				text: (element.textContent ?? '').trim().slice(0, 40),
				ratio: Math.round(ratio(painted, background) * 100) / 100,
				color: getComputedStyle(element).color,
				background: `rgb(${Math.round(background.r)}, ${Math.round(
					background.g
				)}, ${Math.round(background.b)})`,
				element
			};
		})
		.filter(
			(entry): entry is LowContrastText =>
				entry !== null && entry.ratio < minimum
		);

/** Readable summary for a failing expectation. */
export const describeLowContrast = (entries: LowContrastText[]): string[] =>
	entries.map(
		({ text, ratio: value, color, background, element }) =>
			`"${text}" ${value}:1 (${color} on ${background}) in ${element.tagName.toLowerCase()}.${Array.from(element.classList).slice(0, 2).join('.')}`
	);

/** Contrast of an element's own `color` (text or currentColor icon) against what it sits on. */
export const paintedContrast = (element: Element): number => {
	const background = paintedBackground(element);
	const ink = parse(getComputedStyle(element).color);
	if (!ink) {
		return 0;
	}
	return Math.round(ratio(over(ink, background), background) * 100) / 100;
};
