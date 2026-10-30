import { describe, expect, it } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

/**
 * Plural forms each language needs (CLDR categories i18next resolves).
 * `de@informal` inherits `de` (overlay); the wording is impersonal, so it
 * needs no informal variant.
 */
const FORMS: Record<string, string[]> = {
	de: ['one', 'other'],
	en: ['one', 'other'],
	fr: ['one', 'other'],
	ru: ['one', 'few', 'many', 'other'],
	ti: ['one', 'other'],
	tr: ['one', 'other']
};
const catalogues: Record<string, any> = { de, en, fr, ru, ti, tr };

describe('missing-key placeholder wording (#1827)', () => {
	it.each(Object.keys(FORMS))(
		'%s has title and hint for every plural form',
		(lng) => {
			const node = catalogues[lng].e2ee.message.encryption.missingKey;
			for (const form of FORMS[lng]) {
				expect(
					node[`title_${form}`],
					`${lng} title_${form}`
				).toBeTruthy();
				expect(
					node[`hint_${form}`],
					`${lng} hint_${form}`
				).toBeTruthy();
			}
		}
	);

	it.each(Object.keys(FORMS))(
		'%s keeps {{count}} in the counted forms',
		(lng) => {
			const node = catalogues[lng].e2ee.message.encryption.missingKey;
			for (const form of FORMS[lng].filter((f) => f !== 'one')) {
				expect(node[`title_${form}`]).toContain('{{count}}');
			}
		}
	);

	it('german title and hint are calm, not an alarm', () => {
		const node = de.e2ee.message.encryption.missingKey as Record<
			string,
			string
		>;
		expect(node.title_one).toBe(
			'Frühere Nachricht auf diesem Gerät nicht verfügbar'
		);
		for (const text of Object.values(node)) {
			expect(text).not.toMatch(/verschlüsselt|Fehler|fehlgeschlagen/i);
		}
	});
});
