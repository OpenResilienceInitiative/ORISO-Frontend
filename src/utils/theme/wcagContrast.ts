/**
 * WCAG 2.x contrast ratio between two CSS colours, `#rrggbb` or the
 * `rgb()/rgba()` form `getComputedStyle` returns. Alpha is ignored here;
 * `effectiveBackground` resolves translucent backgrounds first.
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

type Rgba = [number, number, number, number];

const rgba = (colour: string): Rgba => {
	const match = colour.match(/rgba\(([^)]+)\)/);
	if (!match) return [...channels(colour), 1];
	const [r, g, b, a = 1] = match[1].split(/[\s,/]+/).map(Number);
	return [r, g, b, a];
};

/**
 * The first opaque background behind an element (white when none).
 * Translucent layers on the way are painted over it, as the browser does,
 * so a 94 % white footer is measured as what is actually seen.
 */
export const effectiveBackground = (element: Element): string => {
	const layers: Rgba[] = [];
	let node: Element | null = element;
	while (node) {
		const background = getComputedStyle(node).backgroundColor;
		if (background && background !== 'transparent') {
			const layer = rgba(background);
			if (layer[3] > 0) layers.push(layer);
			if (layer[3] >= 1) break;
		}
		node = node.parentElement;
	}
	if (!layers.length || layers[layers.length - 1][3] < 1) {
		layers.push([255, 255, 255, 1]);
	}
	const [r, g, b] = layers
		.reverse()
		.reduce(
			(below, [lr, lg, lb, alpha]) =>
				[
					lr * alpha + below[0] * (1 - alpha),
					lg * alpha + below[1] * (1 - alpha),
					lb * alpha + below[2] * (1 - alpha),
					1
				] as Rgba
		)
		.map(Math.round);
	return `rgb(${r}, ${g}, ${b})`;
};
