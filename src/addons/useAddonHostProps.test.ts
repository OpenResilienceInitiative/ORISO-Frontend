// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addonApiCall, readThemeTokens } from './useAddonHostProps';

describe('addonApiCall', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('calls the add-on API with the login and the agency of the placement', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);

		const api = addonApiCall(
			{ apiBase: '/service/addons/demo/api' },
			{ agencyId: 12, sessionId: 34 },
			'https://example.org',
			() => 'token-1'
		);
		await api('entries?x=1', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(
			'https://example.org/service/addons/demo/api/entries?x=1'
		);
		const headers = init.headers as Headers;
		expect(headers.get('Authorization')).toBe('Bearer token-1');
		expect(headers.get('X-Oriso-Agency-Id')).toBe('12');
		expect(headers.get('X-Oriso-Session-Id')).toBe('34');
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('omit');
	});

	it('sends no agency header outside an agency context', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);
		await addonApiCall({ apiBase: '/a' }, {}, '', () => undefined)('/x');
		const headers = fetchMock.mock.calls[0][1].headers as Headers;
		expect(headers.has('X-Oriso-Agency-Id')).toBe(false);
		expect(headers.has('X-Oriso-Session-Id')).toBe(false);
		expect(headers.has('Authorization')).toBe(false);
	});
});

describe('readThemeTokens', () => {
	it('returns only the tenant colour tokens', () => {
		const root = document.createElement('div');
		root.style.setProperty('--m3-primary', '#009fe3');
		root.style.setProperty('--other', 'x');
		expect(readThemeTokens(root)).toEqual({ '--m3-primary': '#009fe3' });
	});
});
