/**
 * WCAG 2.x contrast ratio between two CSS colours, `#rrggbb` or the
 * `rgb()/rgba()` form `getComputedStyle` returns. Alpha is ignored.
 */
const channels = (colour: string): [number, number, number] => {
	const value = colour.trim();
	if (value.startsWith('#')) {
		const n = parseInt(value.slice(1, 7), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	const match = value.match(/rgba?\(([^)]+)\)/);
	if (!match) {
		throw new Error(`wcagContrast: unsupported colour "${colour}"`);
	}
	const [r, g, b] = match[1].split(/[\s,/]+/).map(Number);
	return [r, g, b];
};

const relativeLuminance = (colour: string): number => {
	const [r, g, b] = channels(colour).map((channel) => {
		const c = channel / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const wcagContrast = (a: string, b: string): number => {
	const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(x, y) => y - x
	);
	return (light + 0.05) / (dark + 0.05);
};

const isTransparent = (colour: string) =>
	colour === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(colour);

/** The first painted background behind an element (white when none). */
export const effectiveBackground = (element: Element): string => {
	let node: Element | null = element;
	while (node) {
		const background = getComputedStyle(node).backgroundColor;
		if (background && !isTransparent(background)) {
			return background;
		}
		node = node.parentElement;
	}
	return '#ffffff';
};
