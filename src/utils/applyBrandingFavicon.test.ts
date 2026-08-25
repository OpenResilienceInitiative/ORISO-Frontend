// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyBrandingFavicon } from './applyBrandingFavicon';

const ICON = 'data:image/vnd.microsoft.icon;base64,AAABAAEAICAAAA==';

const iconLinks = () =>
	Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));

describe('applyBrandingFavicon', () => {
	beforeEach(() => {
		document.head.innerHTML = '';
	});

	it('rewrites every declared icon link, not just the first', () => {
		document.head.innerHTML = `
			<link rel="icon" href="/favicon.ico" />
			<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
			<link rel="shortcut icon" href="/legacy.ico" />
		`;

		applyBrandingFavicon(ICON);

		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([
			ICON,
			ICON,
			ICON
		]);
	});

	it('drops size/type hints that described the placeholder PNGs', () => {
		document.head.innerHTML =
			'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />';

		applyBrandingFavicon(ICON);

		expect(iconLinks()[0].getAttribute('sizes')).toBeNull();
		expect(iconLinks()[0].getAttribute('type')).toBeNull();
	});

	it('leaves apple-touch-icon and other rel values untouched', () => {
		document.head.innerHTML = `
			<link rel="icon" href="/favicon.ico" />
			<link rel="apple-touch-icon" href="/logo192.png" />
			<link rel="manifest" href="/manifest.json" />
		`;

		applyBrandingFavicon(ICON);

		expect(
			document
				.querySelector("link[rel='apple-touch-icon']")
				.getAttribute('href')
		).toBe('/logo192.png');
		expect(
			document.querySelector("link[rel='manifest']").getAttribute('href')
		).toBe('/manifest.json');
	});

	it('creates an icon link when the page template declares none', () => {
		applyBrandingFavicon(ICON);

		expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([ICON]);
	});
});
