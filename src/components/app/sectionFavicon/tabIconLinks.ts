/**
 * Swaps the page's tab icon for a section icon and back, without losing the
 * default (the built-in favicon or the tenant's uploaded one).
 *
 * The default `<link rel="icon">` is rewritten in place and remembers its own
 * href/type/sizes in data attributes; a second, managed link carries the PNG
 * fallback and sits before it, so browsers that understand SVG icons take the
 * SVG and the others fall back to the PNG. `applyBrandingFavicon` writes into
 * the remembered default while a section icon is showing.
 */

export const SECTION_ICON_ATTR = 'data-section-icon';
export const DEFAULT_HREF_ATTR = 'data-default-href';
const DEFAULT_TYPE_ATTR = 'data-default-type';
const DEFAULT_SIZES_ATTR = 'data-default-sizes';
const CREATED_ATTR = 'data-section-icon-created';
const PNG_ATTR = 'data-section-icon-png';
const NONE = '\u0000';

const defaultLinks = () =>
	Array.from(
		document.querySelectorAll<HTMLLinkElement>(
			`link[rel~='icon']:not([${PNG_ATTR}])`
		)
	);

const remember = (link: HTMLLinkElement) => {
	if (link.hasAttribute(SECTION_ICON_ATTR)) return;
	link.setAttribute(SECTION_ICON_ATTR, '');
	link.setAttribute(DEFAULT_HREF_ATTR, link.getAttribute('href') ?? NONE);
	link.setAttribute(DEFAULT_TYPE_ATTR, link.getAttribute('type') ?? NONE);
	link.setAttribute(DEFAULT_SIZES_ATTR, link.getAttribute('sizes') ?? NONE);
};

const restoreAttr = (link: HTMLLinkElement, name: string, from: string) => {
	const value = link.getAttribute(from);
	link.removeAttribute(from);
	if (value === null || value === NONE) link.removeAttribute(name);
	else link.setAttribute(name, value);
};

export const showSectionTabIcon = ({
	svgHref,
	pngHref
}: {
	svgHref: string;
	pngHref: string | null;
}): void => {
	let links = defaultLinks();
	if (links.length === 0) {
		const link = document.createElement('link');
		link.setAttribute('rel', 'icon');
		link.setAttribute(CREATED_ATTR, '');
		document.head.appendChild(link);
		links = [link];
	}
	links.forEach((link) => {
		remember(link);
		link.setAttribute('href', svgHref);
		link.setAttribute('type', 'image/svg+xml');
		link.setAttribute('sizes', 'any');
	});

	let png = document.querySelector<HTMLLinkElement>(`link[${PNG_ATTR}]`);
	if (!pngHref) {
		png?.remove();
		return;
	}
	if (!png) {
		png = document.createElement('link');
		png.setAttribute('rel', 'icon');
		png.setAttribute(PNG_ATTR, '');
		png.setAttribute('type', 'image/png');
		png.setAttribute('sizes', '32x32');
	}
	png.setAttribute('href', pngHref);
	links[0].before(png);
};

export const restoreDefaultTabIcon = (): void => {
	document.querySelector(`link[${PNG_ATTR}]`)?.remove();
	document
		.querySelectorAll<HTMLLinkElement>(`link[${SECTION_ICON_ATTR}]`)
		.forEach((link) => {
			if (link.hasAttribute(CREATED_ATTR)) {
				link.remove();
				return;
			}
			link.removeAttribute(SECTION_ICON_ATTR);
			restoreAttr(link, 'href', DEFAULT_HREF_ATTR);
			restoreAttr(link, 'type', DEFAULT_TYPE_ATTR);
			restoreAttr(link, 'sizes', DEFAULT_SIZES_ATTR);
		});
};
