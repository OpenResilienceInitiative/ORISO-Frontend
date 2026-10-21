import { describe, expect, it } from 'vitest';
import { agencyWebsiteHref } from './agencyWebsiteUrl';

// ORISO-Helm#368 (FE-03): a website stored without a scheme was resolved
// against a fixed platform domain and became a link on that domain.
describe('agencyWebsiteHref', () => {
	it('keeps absolute http(s) URLs', () => {
		expect(
			agencyWebsiteHref('https://www.beratung.example.org/kontakt')
		).toBe('https://www.beratung.example.org/kontakt');
		expect(agencyWebsiteHref('http://beratung.example.org')).toBe(
			'http://beratung.example.org/'
		);
	});

	it('prefixes https:// to a bare host', () => {
		expect(agencyWebsiteHref('www.beratung.example.org')).toBe(
			'https://www.beratung.example.org/'
		);
		expect(agencyWebsiteHref('  beratung.example.org/kontakt?x=1 ')).toBe(
			'https://beratung.example.org/kontakt?x=1'
		);
		expect(agencyWebsiteHref('beratung.example.org:8443')).toBe(
			'https://beratung.example.org:8443/'
		);
	});

	it('never resolves a value against another domain', () => {
		for (const value of [
			'www.beratung.example.org',
			'/kontakt',
			'kontakt',
			'../impressum'
		]) {
			const href = agencyWebsiteHref(value);
			expect(href ?? '').not.toContain('oriso');
		}
	});

	it('renders no link for values that are not a host', () => {
		expect(agencyWebsiteHref(undefined)).toBeUndefined();
		expect(agencyWebsiteHref('')).toBeUndefined();
		expect(agencyWebsiteHref('/kontakt')).toBeUndefined();
		expect(agencyWebsiteHref('kontakt')).toBeUndefined();
		expect(agencyWebsiteHref('../impressum')).toBeUndefined();
		expect(agencyWebsiteHref('keine Website')).toBeUndefined();
		expect(agencyWebsiteHref('localhost')).toBeUndefined();
	});

	it('rejects non-web schemes', () => {
		expect(
			agencyWebsiteHref(['javascript', 'alert(1)'].join(':'))
		).toBeUndefined();
		expect(agencyWebsiteHref('mailto:info@example.org')).toBeUndefined();
		expect(agencyWebsiteHref('ftp://example.org')).toBeUndefined();
		expect(agencyWebsiteHref('//example.org')).toBeUndefined();
	});
});
