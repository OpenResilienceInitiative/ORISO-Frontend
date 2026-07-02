import { type Avatar, recolorSvg } from './anonName/engine';

export * from './anonName/engine';

const svgCache = new Map<string, string>();
const baseUrl = `${process.env.PUBLIC_URL || ''}/assets/anon-animals`;

function assertValidSvg(svgText: string, file: string): void {
	const trimmedSvg = svgText.trim();
	if (!trimmedSvg) {
		throw new Error(`Empty avatar SVG: ${file}`);
	}

	if (typeof DOMParser === 'undefined') {
		if (!/^<svg[\s>]/i.test(trimmedSvg)) {
			throw new Error(`Invalid avatar SVG: ${file}`);
		}
		return;
	}

	const doc = new DOMParser().parseFromString(trimmedSvg, 'image/svg+xml');
	if (
		doc.documentElement.nodeName.toLowerCase() !== 'svg' ||
		doc.querySelector('parsererror')
	) {
		throw new Error(`Invalid avatar SVG: ${file}`);
	}
}

export async function renderAvatarSvg(avatar: Avatar): Promise<string> {
	const url = `${baseUrl}/${avatar.file}`;
	let svg = svgCache.get(url);

	if (!svg) {
		const response = await fetch(url);
		const contentType = response.headers.get('content-type') || '';
		if (!response.ok || !contentType.toLowerCase().includes('image/svg')) {
			throw new Error(`Failed to load avatar SVG: ${avatar.file}`);
		}
		svg = await response.text();
		assertValidSvg(svg, avatar.file);
		svgCache.set(url, svg);
	}

	return recolorSvg(svg, avatar.iconColor);
}
