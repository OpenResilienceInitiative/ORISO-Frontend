// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { restoreDefaultTabIcon, showSectionTabIcon } from './tabIconLinks';
import { applyBrandingFavicon } from '../../../utils/applyBrandingFavicon';

const SVG = 'data:image/svg+xml,%3Csvg%2F%3E';
const PNG = 'data:image/png;base64,AAAA';
const BRAND = 'data:image/vnd.microsoft.icon;base64,AAAB';

const iconLinks = () =>
	Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));

describe('section tab icon links', () => {
	beforeEach(() => {
		document.head.innerHTML = '<link rel="icon" href="/favicon.ico" />';
	});

	it('swaps the default icon for the section SVG and adds a PNG fallback before it', () => {
		showSectionTabIcon({ svgHref: SVG, pngHref: PNG });

		const [png, svg] = iconLinks();
		expect(png.getAttribute('href')).toBe(PNG);
		expect(png.getAttribute('type')).toBe('image/png');
		expect(png.getAttribute('sizes')).toBe('32x32');
		expect(svg.getAttribute('href')).toBe(SVG);
		expect(svg.getAttribute('type')).toBe('image/svg+xml');
		expect(svg.getAttribute('sizes')).toBe('any');
	});

	it('restores the default icon exactly and removes the fallback', () => {
		showSectionTabIcon({ svgHref: SVG, pngHref: PNG });
		showSectionTabIcon({ svgHref: SVG + '2', pngHref: null });
		restoreDefaultTabIcon();

		const links = iconLinks();
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute('href')).toBe('/favicon.ico');
		expect(links[0].hasAttribute('type')).toBe(false);
		expect(links[0].hasAttribute('sizes')).toBe(false);
	});

	it('drops a stale PNG when the next section has none yet', () => {
		showSectionTabIcon({ svgHref: SVG, pngHref: PNG });
		showSectionTabIcon({ svgHref: SVG + '2', pngHref: null });
		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([
			SVG + '2'
		]);
	});

	it('keeps a tenant favicon that arrives while a section icon shows as the new default', () => {
		showSectionTabIcon({ svgHref: SVG, pngHref: PNG });
		applyBrandingFavicon(BRAND);

		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([
			PNG,
			SVG
		]);

		restoreDefaultTabIcon();
		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([BRAND]);
	});

	it('is a no-op to restore when no section icon was shown', () => {
		restoreDefaultTabIcon();
		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([
			'/favicon.ico'
		]);
	});

	it('creates an icon link when the page declared none', () => {
		document.head.innerHTML = '';
		showSectionTabIcon({ svgHref: SVG, pngHref: null });
		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([SVG]);
		restoreDefaultTabIcon();
		expect(iconLinks()).toHaveLength(0);
	});
});
