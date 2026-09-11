import { describe, expect, it } from 'vitest';
import { getLegalLinkKind } from './useLegalLinkContent';

describe('getLegalLinkKind', () => {
	it('trusts the raw i18n key over the translated title', () => {
		// French privacy contains neither "daten" nor "privacy"; without the
		// key this resolved to the imprint and opened the wrong tenant text.
		expect(
			getLegalLinkKind(
				'Politique de confidentialité',
				'https://example.test/legal/fr',
				'login.legal.infoText.dataprotection'
			)
		).toBe('privacy');
	});

	it('does the same for imprint', () => {
		expect(
			getLegalLinkKind(
				'Mentions légales',
				'https://example.test/legal/fr',
				'login.legal.infoText.impressum'
			)
		).toBe('imprint');
	});

	it('never lets a privacy title override an imprint key', () => {
		expect(
			getLegalLinkKind(
				'Datenschutz',
				'https://example.test/datenschutz',
				'login.legal.infoText.impressum'
			)
		).toBe('imprint');
	});

	it('falls back to title and url when no key is supplied', () => {
		expect(
			getLegalLinkKind('Datenschutz', 'https://example.test/datenschutz')
		).toBe('privacy');
		expect(
			getLegalLinkKind('Impressum', 'https://example.test/impressum')
		).toBe('imprint');
	});
});
