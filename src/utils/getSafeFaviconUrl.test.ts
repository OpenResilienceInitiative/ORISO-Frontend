// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getSafeFaviconUrl } from './getSafeFaviconUrl';

describe('getSafeFaviconUrl', () => {
	it.each([
		'/favicon.ico',
		'https://assets.example.test/branding/favicon.png',
		'data:image/png;base64,iVBORw0KGgo=',
		// The two MIME types browsers report for a picked .ico file.
		'data:image/x-icon;base64,AAABAAEAICAAAA==',
		'data:image/vnd.microsoft.icon;base64,AAABAAEAICAAAA=='
	])('keeps a valid favicon URL (%s)', (favicon) => {
		expect(getSafeFaviconUrl(favicon)).toBe(favicon);
	});

	it.each([
		'',
		'data:image;base64,broken',
		'data:text/plain;base64,not-an-image',
		// A .ico whose MIME type the OS could not map: accepted by the uploader
		// on its file extension, but not an image data URL.
		'data:application/octet-stream;base64,AAABAAEAICAAAA==',
		// Never decoded on the way out of TenantService.
		'data:image/x-icon;base64,AAAB&#43;AAA&#61;',
		['java', 'script:alert(1)'].join('')
	])('rejects an invalid favicon URL (%s)', (favicon) => {
		expect(getSafeFaviconUrl(favicon)).toBeUndefined();
	});
});
