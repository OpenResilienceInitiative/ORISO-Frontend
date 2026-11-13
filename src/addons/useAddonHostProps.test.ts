// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	addonApiCall,
	addonNotice,
	readThemeTokens
} from './useAddonHostProps';

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

describe('addonNotice', () => {
	it('maps an add-on message onto a host notification', () => {
		expect(
			addonNotice({
				type: 'success',
				text: 'Gespeichert',
				title: 'Ziele'
			})
		).toEqual({
			notificationType: 'success',
			title: 'Ziele',
			text: 'Gespeichert',
			closeable: true,
			timeout: 4000,
			announce: 'status'
		});
	});

	it('keeps errors longer and announces them at once', () => {
		expect(addonNotice({ type: 'error', text: 'Fehler' })).toMatchObject({
			notificationType: 'error',
			title: '',
			timeout: 8000,
			announce: 'alert'
		});
	});

	it('treats unknown types as info and only takes plain text', () => {
		const notice = addonNotice({
			type: 'shout' as never,
			text: 'x'.repeat(400),
			title: { html: '<b>' } as never
		});
		expect(notice?.notificationType).toBe('info');
		expect(notice?.text).toHaveLength(300);
		expect(notice?.title).toBe('');
	});

	it('ignores a message without text', () => {
		expect(addonNotice({ type: 'info', text: '' })).toBeNull();
		expect(addonNotice(undefined as never)).toBeNull();
	});
});
