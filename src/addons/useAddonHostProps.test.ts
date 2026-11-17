// @vitest-environment jsdom
import { createElement, PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleContext } from '../globalState';
import {
	addonApiCall,
	addonPublicApiCall,
	addonNotice,
	readThemeTokens,
	useAddonHostProps
} from './useAddonHostProps';
import { AvailableAddon } from './addonTypes';

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

	it('includes the default palette declared in the stylesheets', () => {
		const style = document.createElement('style');
		style.textContent = ':root { --m3-surface: #fff; --unrelated: 1px; }';
		document.head.appendChild(style);
		const root = document.documentElement;
		root.style.setProperty('--m3-primary', '#009fe3');
		const computed = {
			getPropertyValue: (name: string) =>
				({ '--m3-surface': ' #fafafa', '--m3-primary': '#009fe3' })[
					name
				] ?? ''
		};
		try {
			expect(readThemeTokens(root, computed)).toEqual({
				'--m3-primary': '#009fe3',
				'--m3-surface': '#fafafa'
			});
		} finally {
			style.remove();
			root.style.removeProperty('--m3-primary');
		}
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

	it('escapes markup, because the host renders string notifications as HTML', () => {
		const notice = addonNotice({
			type: 'info',
			title: '<b>Ziele</b>',
			text: '<img src=x onerror=alert(1)> & mehr'
		});
		expect(notice?.title).toBe('&lt;b&gt;Ziele&lt;/b&gt;');
		expect(notice?.text).toBe(
			'&lt;img src=x onerror=alert(1)&gt; &amp; mehr'
		);
	});
});

describe('addonPublicApiCall', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('calls the public API with the Träger and without a login', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);

		await addonPublicApiCall(
			{ apiBase: '/service/addons/finder/public/api' },
			7,
			'https://example.org'
		)('agencies?postcode=10115', {
			headers: { Authorization: 'Bearer leaked' }
		});

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(
			'https://example.org/service/addons/finder/public/api/agencies?postcode=10115'
		);
		const headers = init.headers as Headers;
		expect(headers.get('X-Oriso-Tenant-Id')).toBe('7');
		expect(headers.has('Authorization')).toBe(false);
		expect(init.credentials).toBe('omit');
	});
});

describe('useAddonHostProps', () => {
	const addon: AvailableAddon = {
		name: 'demo',
		version: '1.0.0',
		entry: '/service/addons/demo/ui/entry.js',
		apiBase: '/service/addons/demo/api',
		apps: [
			{ id: 'page', title: { de: 'Demo' }, slots: ['consultant.session'] }
		]
	};

	it('keeps the api client when only unrelated host props change', () => {
		let locale = 'de';
		const wrapper = ({ children }: PropsWithChildren) =>
			createElement(
				MemoryRouter,
				null,
				createElement(
					LocaleContext.Provider,
					{ value: { locale } as never },
					children
				)
			);
		const { result, rerender } = renderHook(
			({ sessionId }) =>
				useAddonHostProps(addon, addon.apps[0], 'consultant.session', {
					agencyId: 3,
					sessionId
				}),
			{ wrapper, initialProps: { sessionId: 42 } }
		);
		const first = result.current;

		locale = 'en';
		rerender({ sessionId: 42 });
		expect(result.current.locale).toBe('en');
		expect(result.current.api).toBe(first.api);

		rerender({ sessionId: 43 });
		expect(result.current.api).not.toBe(first.api);
	});
});
