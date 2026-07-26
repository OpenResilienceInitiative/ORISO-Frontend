import { describe, expect, it } from 'vitest';
import { resolveTenantMediaUrl } from './resolveTenantMediaUrl';

const ORIGIN = 'https://api.oriso-dev.site';

describe('resolveTenantMediaUrl', () => {
	it('prefixes a root-relative /media path with the tenant origin', () => {
		expect(resolveTenantMediaUrl('/media/abc-123', ORIGIN)).toBe(
			'https://api.oriso-dev.site/media/abc-123'
		);
	});

	it('strips a trailing slash on the origin so the result has one slash', () => {
		expect(resolveTenantMediaUrl('/media/x', 'https://api.test/')).toBe(
			'https://api.test/media/x'
		);
	});

	it('leaves the path relative when the origin is empty (dev proxy)', () => {
		expect(resolveTenantMediaUrl('/media/x', '')).toBe('/media/x');
	});

	it('never touches absolute, data, blob or non-media sources', () => {
		expect(resolveTenantMediaUrl('https://cdn/x.png', ORIGIN)).toBe(
			'https://cdn/x.png'
		);
		expect(
			resolveTenantMediaUrl('data:image/png;base64,AAAA', ORIGIN)
		).toBe('data:image/png;base64,AAAA');
		expect(resolveTenantMediaUrl('/static/logo.png', ORIGIN)).toBe(
			'/static/logo.png'
		);
		// guards against a naive contains-check hijacking an unrelated path
		expect(resolveTenantMediaUrl('/x/media/y', ORIGIN)).toBe('/x/media/y');
	});

	it('is safe on undefined src', () => {
		expect(resolveTenantMediaUrl(undefined, ORIGIN)).toBeUndefined();
	});
});
