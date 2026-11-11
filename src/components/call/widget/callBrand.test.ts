// @vitest-environment oriso-jsdom

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { applyTenantPalette } from '../../../utils/theme/applyTenantTheme';
import { callBrandParams } from './callBrand';

const BASE = 'https://app.oriso.example/service/tenant';

const GREEN = {
	primaryColor: '#0A7A3C',
	accent: '#646d78',
	signal: '#b1005e',
	logo: 'data:image/png;base64,AAAA'
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('callBrandParams (#2188)', () => {
	describe('a Traeger with colours and a logo', () => {
		it('hands over all four parameters, in a fixed order', () => {
			const params = callBrandParams({ id: 14, theming: GREEN }, BASE);

			expect(Object.entries(params)).toEqual([
				['orisoPrimary', '0a7a3c'],
				['orisoAccent', '646d78'],
				['orisoSignal', 'b1005e'],
				[
					'orisoLogo',
					'https://app.oriso.example/service/tenant/public/branding/14/logo'
				]
			]);
		});

		it('writes colours as six lower-case hex digits, never with a hash', () => {
			const params = callBrandParams(
				{ id: 14, theming: { primaryColor: 'A5000A' } },
				BASE
			);
			expect(params.orisoPrimary).toBe('a5000a');

			const shorthand = callBrandParams(
				{ id: 14, theming: { primaryColor: '#F00' } },
				BASE
			);
			expect(shorthand.orisoPrimary).toBe('ff0000');
			for (const value of [params.orisoPrimary, shorthand.orisoPrimary]) {
				expect(value).toMatch(/^[0-9a-f]{6}$/);
			}
		});

		it('sends the branding route, never the stored logo itself', () => {
			const { orisoLogo } = callBrandParams(
				{ id: 14, theming: GREEN },
				BASE
			);
			expect(orisoLogo).not.toMatch(/^data:/);
			expect(orisoLogo).not.toContain('base64');
		});

		it('survives a trailing slash on the service base', () => {
			expect(
				callBrandParams({ id: 7, theming: GREEN }, `${BASE}/`).orisoLogo
			).toBe(
				'https://app.oriso.example/service/tenant/public/branding/7/logo'
			);
		});
	});

	describe('a Traeger without colours or logo', () => {
		it.each([
			['no tenant', null],
			['an unresolved tenant', undefined],
			['a tenant without theming', { id: 14 }],
			['empty theming', { id: 14, theming: {} }],
			[
				'blank colours and a blank logo',
				{
					id: 14,
					theming: {
						primaryColor: '',
						accent: ' ',
						signal: null,
						logo: ''
					}
				}
			],
			[
				'null colours and a null logo',
				{
					id: 14,
					theming: {
						primaryColor: null,
						accent: null,
						signal: null,
						logo: null
					}
				}
			]
		] as const)('sends nothing for %s', (_label, tenant) => {
			expect(callBrandParams(tenant, BASE)).toEqual({});
		});
	});

	describe('each colour on its own', () => {
		it('leaves an invalid accent out and keeps the others', () => {
			const params = callBrandParams(
				{ id: 14, theming: { ...GREEN, accent: 'nope' } },
				BASE
			);
			expect(params).not.toHaveProperty('orisoAccent');
			expect(params.orisoPrimary).toBe('0a7a3c');
			expect(params.orisoSignal).toBe('b1005e');
		});

		it('leaves an invalid signal out and keeps the others', () => {
			const params = callBrandParams(
				{ id: 14, theming: { ...GREEN, signal: '#12345' } },
				BASE
			);
			expect(params).not.toHaveProperty('orisoSignal');
			expect(params.orisoPrimary).toBe('0a7a3c');
			expect(params.orisoAccent).toBe('646d78');
		});

		it('leaves out an accent and a signal that were never set', () => {
			const params = callBrandParams(
				{ id: 14, theming: { primaryColor: '#0a7a3c' } },
				BASE
			);
			expect(params).toEqual({ orisoPrimary: '0a7a3c' });
		});
	});

	describe('a primary the app would not paint with', () => {
		it.each([
			['a too pale primary (grey)', '#888888'],
			['a too pale primary (black)', '#000000'],
			['an invalid primary', 'not-a-hex'],
			['a missing primary', undefined]
		] as const)('sends no colour at all for %s', (_label, primary) => {
			const params = callBrandParams(
				{
					id: 14,
					theming: {
						primaryColor: primary,
						accent: '#646d78',
						signal: '#b1005e',
						logo: 'data:image/png;base64,AAAA'
					}
				},
				BASE
			);
			expect(params).not.toHaveProperty('orisoPrimary');
			expect(params).not.toHaveProperty('orisoAccent');
			expect(params).not.toHaveProperty('orisoSignal');
		});

		it('still sends the logo, which does not depend on the colours', () => {
			expect(
				callBrandParams(
					{
						id: 14,
						theming: { primaryColor: '#888888', logo: 'x' }
					},
					BASE
				)
			).toEqual({
				orisoLogo:
					'https://app.oriso.example/service/tenant/public/branding/14/logo'
			});
		});
	});

	describe('the logo', () => {
		it.each([
			['null', null],
			['undefined', undefined],
			['empty', ''],
			['blank', '   ']
		] as const)('is left out when it is %s', (_label, logo) => {
			const params = callBrandParams(
				{ id: 14, theming: { ...GREEN, logo } },
				BASE
			);
			expect(params).not.toHaveProperty('orisoLogo');
			expect(params.orisoPrimary).toBe('0a7a3c');
		});

		it.each([
			['missing', undefined],
			['null', null],
			['zero', 0],
			['negative', -3],
			['fractional', 1.5],
			['not a number', Number.NaN],
			['unsafe', Number.MAX_SAFE_INTEGER + 2]
		] as const)(
			'is left out when the tenant id is %s: there is no route to name',
			(_label, id) => {
				const params = callBrandParams({ id, theming: GREEN }, BASE);
				expect(params).not.toHaveProperty('orisoLogo');
				expect(params.orisoPrimary).toBe('0a7a3c');
			}
		);

		it.each([
			['plain http', 'http://app.oriso.example/service/tenant'],
			['relative', '/service/tenant'],
			['empty', ''],
			['not a URL', 'service tenant'],
			['another scheme', 'ftp://app.oriso.example/service/tenant'],
			['a data URL', 'data:text/plain,hello']
		] as const)(
			'is left out when the service base is %s: the call cannot fetch it',
			(_label, base) => {
				const params = callBrandParams(
					{ id: 14, theming: GREEN },
					base
				);
				expect(params).not.toHaveProperty('orisoLogo');
				expect(params.orisoPrimary).toBe('0a7a3c');
			}
		);
	});

	describe('agrees with what the app paints', () => {
		// [what is stored, the colour parameters the call gets]
		it.each([
			['a plain brand', { primaryColor: '#0a7a3c' }, ['orisoPrimary']],
			[
				'all three seeds',
				{
					primaryColor: '#0a7a3c',
					accent: '#646d78',
					signal: '#b1005e'
				},
				['orisoPrimary', 'orisoAccent', 'orisoSignal']
			],
			[
				'an invalid accent',
				{ primaryColor: '#0a7a3c', accent: 'nope', signal: '#b1005e' },
				['orisoPrimary', 'orisoSignal']
			],
			[
				'an invalid signal',
				{ primaryColor: '#0a7a3c', accent: '#646d78', signal: 'nope' },
				['orisoPrimary', 'orisoAccent']
			],
			[
				'a too pale primary',
				{ primaryColor: '#888888', accent: '#646d78' },
				[]
			],
			[
				'an invalid primary',
				{ primaryColor: 'nope', signal: '#b1005e' },
				[]
			],
			['no colours', {}, []]
		] as const)('%s', (_label, theming, expected) => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			const paints = applyTenantPalette(
				theming,
				document.createElement('div')
			);

			const params = callBrandParams({ id: 14, theming }, BASE);

			// The call gets colours exactly when the app applies a palette ...
			expect('orisoPrimary' in params).toBe(paints);
			// ... and exactly the ones the app resolved.
			expect(Object.keys(params)).toEqual([...expected]);
		});
	});
});
