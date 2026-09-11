import { describe, expect, it } from 'vitest';
import { buildOsmSearchUrl } from './osmLink';

describe('buildOsmSearchUrl', () => {
	it('builds a search url from full address parts', () => {
		expect(
			buildOsmSearchUrl({
				street: 'Musterstraße',
				houseNumber: '12a',
				postcode: '10115',
				city: 'Berlin'
			})
		).toBe(
			'https://www.openstreetmap.org/search?query=' +
				encodeURIComponent('Musterstraße 12a, 10115 Berlin')
		);
	});

	it('falls back to postcode and city only', () => {
		expect(buildOsmSearchUrl({ postcode: '10115', city: 'Berlin' })).toBe(
			'https://www.openstreetmap.org/search?query=' +
				encodeURIComponent('10115 Berlin')
		);
	});

	it('returns null without any address part', () => {
		expect(buildOsmSearchUrl({})).toBeNull();
	});
});
