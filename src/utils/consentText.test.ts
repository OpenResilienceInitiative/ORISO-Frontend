import { describe, expect, it } from 'vitest';
import { hasLegalLinksToken, substituteLegalLinks } from './consentText';

const LINKS =
	'<a href="https://oriso.test/datenschutz">Datenschutzerklärung</a>, <a href="https://oriso.test/impressum">Impressum</a>';

describe('consentText — the client half of the split substitution', () => {
	it('replaces the {{legal_links}} token in place', () => {
		expect(
			substituteLegalLinks(
				'Ich habe die {{legal_links}} zur Kenntnis genommen.',
				LINKS
			)
		).toBe(`Ich habe die ${LINKS} zur Kenntnis genommen.`);
	});

	it('tolerates whitespace inside the braces', () => {
		expect(
			substituteLegalLinks('Siehe {{ legal_links }}.', LINKS)
		).toContain(LINKS);
	});

	it('replaces every occurrence, not just the first', () => {
		const result = substituteLegalLinks(
			'{{legal_links}} und nochmal {{legal_links}}',
			'<a href="#x">L</a>'
		);
		expect(result).toBe(
			'<a href="#x">L</a> und nochmal <a href="#x">L</a>'
		);
	});

	it('inserts $-sequences from the links markup literally', () => {
		// `String.replace` reads `$&` in the *replacement* as "the whole match".
		// A URL may legitimately contain it, and a consent link silently
		// mutating into `{{legal_links}}` would be very hard to spot.
		const dollarLink = '<a href="https://oriso.test/d?q=$&amp;x=$1">D</a>';
		expect(substituteLegalLinks('A {{legal_links}} B', dollarLink)).toBe(
			`A ${dollarLink} B`
		);
	});

	it('appends the links when the mandatory token is missing', () => {
		// ADR-021 decision 2 makes the token mandatory at publication time,
		// server-side. The client must not depend on that validator having run:
		// a consent sentence without a reachable policy is not a valid consent.
		const result = substituteLegalLinks(
			'Ich stimme der Verarbeitung zu.',
			LINKS
		);
		expect(result).toContain('Ich stimme der Verarbeitung zu.');
		expect(result).toContain(LINKS);
	});

	it('does not treat the Freemarker dialect as a token', () => {
		// ADR-021 decision 6 — Träger text never passes through Freemarker.
		/* eslint-disable-next-line no-template-curly-in-string -- the Freemarker dialect is the subject of this assertion, not a mistake. */
		expect(hasLegalLinksToken('Siehe ${legal_links}.')).toBe(false);
	});

	it('reports token presence independently of previous calls', () => {
		// Guards against a lastIndex-carrying shared /g regex, which would make
		// every second call answer `false` for the same input.
		expect(hasLegalLinksToken('a {{legal_links}} b')).toBe(true);
		expect(hasLegalLinksToken('a {{legal_links}} b')).toBe(true);
	});
});
