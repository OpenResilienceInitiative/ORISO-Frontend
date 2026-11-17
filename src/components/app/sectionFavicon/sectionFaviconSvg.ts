import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Per-section browser tab icon (FE: section favicons).
 *
 * The tab shows the same glyph the navigation rail shows for the section the
 * person is in: a rounded tile in the `primary` token with the glyph in the
 * `on-primary` token (Frank, 2026-11-17). Both are read from the live design
 * tokens, so a Träger's own palette (applyTenantPalette) reaches the tab too;
 * this file holds no colour values. It is computed on every route change from
 * what is already in memory; nothing is stored.
 */

/** The design tokens the tab icon is painted with. */
export const FAVICON_TILE_TOKEN = '--m3-primary';
export const FAVICON_GLYPH_TOKEN = '--m3-on-primary';

export interface FaviconColors {
	tile: string;
	glyph: string;
}

const TILE_SIZE = 64;
const TILE_RADIUS = 14;

/**
 * How much of the tile the glyph's ink fills, and how much its lines are
 * thickened (share of the glyph size). Frank, 2026-11-17: small icons need
 * little padding and a bit more weight to stay readable; a large preview
 * looks right with more air around the glyph.
 *   tab   — the real browser tab icon (shown at 16–32 px)
 *   large — previews (Storybook, 64 px and up)
 */
export type FaviconFit = 'tab' | 'large';
const FITS: Record<FaviconFit, { glyph: number; weight: number }> = {
	tab: { glyph: 46, weight: 0.045 },
	large: { glyph: 38, weight: 0 }
};
/** Without a measured ink box, the icon's own viewBox (with its padding) is used. */
const UNMEASURED_GLYPH = 40;

type IconComponent = ComponentType<any>;

export interface SectionNavItem {
	to?: string;
	icon?: IconComponent;
	iconFilled?: IconComponent;
	[key: string]: unknown;
}

/**
 * The navigation entry whose section `pathname` is in, or null (login, plain
 * pages, anything the rail has no entry for: the default favicon stays).
 * A path belongs to an entry when it is the entry's path or below it — never a
 * mere string prefix (`/profileX` is not `/profile`). The most specific entry wins.
 */
export const resolveSectionNavItem = (
	pathname: string,
	navigation: ReadonlyArray<SectionNavItem | null | undefined> | undefined
): SectionNavItem | null => {
	let best: SectionNavItem | null = null;
	for (const item of navigation ?? []) {
		const to = item?.to;
		if (!to || !(item.iconFilled || item.icon)) continue;
		const inSection = pathname === to || pathname.startsWith(`${to}/`);
		if (inSection && (!best || to.length > (best.to?.length ?? 0))) {
			best = item;
		}
	}
	return best;
};

/** The glyph the rail shows for an active entry. */
export const sectionIconOf = (item: SectionNavItem): IconComponent | null =>
	item.iconFilled ?? item.icon ?? null;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.%\s,/+-]+\)$/i;
const NAMED = /^[a-z]{3,20}$/i;

/**
 * A plain colour value, or null. The value goes into SVG markup, so anything
 * that is not a hex, rgb()/hsl() or named colour is rejected, not escaped.
 */
export const plainColor = (color: string | null | undefined): string | null => {
	const value = typeof color === 'string' ? color.trim() : '';
	return HEX.test(value) || FUNCTIONAL.test(value) || NAMED.test(value)
		? value
		: null;
};

const readToken = (root: HTMLElement, name: string): string =>
	getComputedStyle(root).getPropertyValue(name).trim() ||
	root.style.getPropertyValue(name).trim();

/**
 * Tile and glyph colours from the design tokens in effect on `root`
 * (compiled defaults, overridden by the Träger palette). Null when either is
 * missing or not a plain colour: the default favicon then stays.
 */
export const readFaviconColors = (
	root: HTMLElement = document.documentElement
): FaviconColors | null => {
	const tile = plainColor(readToken(root, FAVICON_TILE_TOKEN));
	const glyph = plainColor(readToken(root, FAVICON_GLYPH_TOKEN));
	return tile && glyph ? { tile, glyph } : null;
};

/** The glyph's ink bounds in its own viewBox units. */
export interface GlyphBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Measures where the glyph actually draws (its ink), so every icon can fill
 * the tile equally whatever padding its file carries. Needs a rendering
 * browser; returns null elsewhere (jsdom), and the icon's viewBox is used.
 */
export const measureGlyphBox = (Icon: IconComponent): GlyphBox | null => {
	let host: SVGSVGElement | null = null;
	try {
		host = document.createElementNS(SVG_NS, 'svg');
		host.setAttribute('aria-hidden', 'true');
		host.style.cssText =
			'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
		host.innerHTML = renderToStaticMarkup(createElement(Icon));
		const inner = host.firstElementChild;
		if (!inner) return null;
		const ink = document.createElementNS(SVG_NS, 'g');
		while (inner.firstChild) ink.appendChild(inner.firstChild);
		inner.appendChild(ink);
		document.body.appendChild(host);
		const box = ink.getBBox?.();
		return box && box.width > 0 && box.height > 0
			? { x: box.x, y: box.y, width: box.width, height: box.height }
			: null;
	} catch {
		return null;
	} finally {
		host?.remove();
	}
};

/** Place the rendered icon's root `<svg>` inside the tile (drop its own size). */
const placeGlyph = (
	markup: string,
	fit: FaviconFit,
	box: GlyphBox | null
): string =>
	markup.replace(/^<svg\b([^>]*)>/, (_match, attrs: string) => {
		const stripped = attrs.replace(
			/\s(?:width|height|x|y|class|aria-hidden|aria-label|stroke-width)="[^"]*"/g,
			''
		);
		const size = box ? FITS[fit].glyph : UNMEASURED_GLYPH;
		const offset = (TILE_SIZE - size) / 2;
		let rest = stripped;
		let weight = '';
		if (box) {
			// Crop to the ink, with room for the added line weight.
			const stroke = Math.max(box.width, box.height) * FITS[fit].weight;
			const pad = stroke / 2;
			rest = rest.replace(/\sviewBox="[^"]*"/, '');
			rest += ` viewBox="${round(box.x - pad)} ${round(box.y - pad)} ${round(
				box.width + stroke
			)} ${round(box.height + stroke)}"`;
			if (stroke > 0) weight = ` stroke-width="${round(stroke)}"`;
		}
		rest = rest.trim();
		return `<svg x="${offset}" y="${offset}" width="${size}" height="${size}"${weight}${rest ? ` ${rest}` : ''}>`;
	});

/** The tab icon as standalone SVG markup. */
export const buildSectionFaviconSvg = (
	Icon: IconComponent,
	colors: FaviconColors,
	{
		fit = 'tab',
		box = null
	}: { fit?: FaviconFit; box?: GlyphBox | null } = {}
): string => {
	const tile = plainColor(colors.tile);
	const color = plainColor(colors.glyph);
	if (!tile || !color) {
		throw new Error('buildSectionFaviconSvg: colours must be plain values');
	}
	const glyph = placeGlyph(
		renderToStaticMarkup(createElement(Icon)),
		fit,
		box
	);
	const bold = box && FITS[fit].weight > 0;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" width="${TILE_SIZE}" height="${TILE_SIZE}">` +
		`<rect width="${TILE_SIZE}" height="${TILE_SIZE}" rx="${TILE_RADIUS}" fill="${tile}"/>` +
		// Some icon files hard-code a fill that the rail recolours with CSS
		// (counsellor_request_filled.svg); do the same here. At tab size thin
		// lines get a little weight: a stroke in the glyph colour.
		`<style>.glyph [fill]:not([fill="none"]){fill:${color}}` +
		(bold
			? `.glyph path,.glyph circle,.glyph ellipse,.glyph polygon{stroke:${color};stroke-linejoin:round}`
			: '') +
		`</style>` +
		`<g class="glyph" fill="${color}" color="${color}">${glyph}</g>` +
		`</svg>`
	);
};

export const toSvgDataUrl = (svg: string): string =>
	`data:image/svg+xml,${encodeURIComponent(svg)}`;

/**
 * PNG copy of the icon for browsers that ignore SVG tab icons (older Safari).
 * Resolves null where there is no canvas (tests, very old browsers).
 */
export const svgToPngDataUrl = (
	svg: string,
	size = 32
): Promise<string | null> =>
	new Promise((resolve) => {
		try {
			const canvas = document.createElement('canvas');
			const context = canvas.getContext?.('2d');
			if (!context || typeof Image === 'undefined') {
				resolve(null);
				return;
			}
			canvas.width = size;
			canvas.height = size;
			const image = new Image();
			image.onload = () => {
				try {
					context.drawImage(image, 0, 0, size, size);
					resolve(canvas.toDataURL('image/png'));
				} catch {
					resolve(null);
				}
			};
			image.onerror = () => resolve(null);
			image.src = toSvgDataUrl(svg);
		} catch {
			resolve(null);
		}
	});
