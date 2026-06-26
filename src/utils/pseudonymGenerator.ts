import { type Avatar, recolorSvg } from './anonName/engine';

export * from './anonName/engine';

const svgCache = new Map<string, string>();
const baseUrl = `${process.env.PUBLIC_URL || ''}/assets/anon-animals`;

export async function renderAvatarSvg(avatar: Avatar): Promise<string> {
	const url = `${baseUrl}/${avatar.file}`;
	let svg = svgCache.get(url);

	if (!svg) {
		const response = await fetch(url);
		svg = await response.text();
		svgCache.set(url, svg);
	}

	return recolorSvg(svg, avatar.iconColor);
}
