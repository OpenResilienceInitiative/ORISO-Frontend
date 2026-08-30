import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Legal notices, department legal chrome, and the public DPA sign page
 * used to pass German strings as i18next fallbacks. Missing keys then
 * snapped to one language instead of the `fallbackLng` chain (#1154).
 */
const SLICE_FILES = [
	'src/components/dpaSign/DpaSign.tsx',
	'src/components/legalContent/LegalContentRenderer.tsx',
	'src/components/departmentLegal/DepartmentLegalSection.tsx'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'AVV unterzeichnen'/,
	/'Bitte lesen Sie die Vereinbarung vollständig/,
	/'Vereinbarung wird geladen/,
	/'Auftragsverarbeitungsvereinbarung'/,
	/'Vertragsversion'/,
	/'Bestätigung der vertretungsberechtigten Person'/,
	/'Anmerkung \(optional\)'/,
	/'Sie unterzeichnen im Namen von:'/,
	/'Ich habe die oben angezeigte Vereinbarung gelesen/,
	/'Verbindlich bestätigen'/,
	/'Die AVV-Bestätigung wurde gespeichert\.'/,
	/'Der Signaturlink ist unvollständig\.'/,
	/'Die Vereinbarung muss vollständig geladen sein/,
	/'Bitte bestätigen Sie die Vereinbarung\.'/,
	/'Die Vereinbarung konnte gerade nicht geladen werden\.'/,
	/'Dieser Signaturlink ist ungültig/,
	/'Die Angaben konnten nicht gespeichert werden/,
	/'Die Signatur konnte gerade nicht gespeichert werden\.'/,
	/'Original anzeigen'/,
	/'Maschinell übersetzt/,
	/'Dieser Text liegt nicht in Ihrer Sprache vor/,
	/'Sie sehen die Originalfassung\.'/,
	/'Übersetzung anzeigen'/,
	/'Datenschutzhinweise der Beratungsstelle'/,
	/'Fachbereich'/,
	/'Die Datenschutzhinweise können derzeit nicht geladen werden\.'/,
	/'Impressum der Beratungsstelle'/
];

const REQUIRED_DPA_KEYS = [
	'contractHeading',
	'version',
	'signerName',
	'signerPosition',
	'signerEmail',
	'signerNote',
	'language'
] as const;

describe('legal and DPA chrome have no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});

	it('ships the DPA form-label keys in every UI locale', () => {
		const locales = ['de', 'en', 'fr', 'ru', 'ti', 'tr'];
		for (const locale of locales) {
			const catalogue = JSON.parse(
				readFileSync(
					resolve(
						process.cwd(),
						`src/resources/i18n/${locale}/common.json`
					),
					'utf8'
				)
			) as { dpaSign?: Record<string, string> };
			for (const key of REQUIRED_DPA_KEYS) {
				expect(
					catalogue.dpaSign?.[key],
					`${locale} ${key}`
				).toBeTruthy();
			}
		}
	});
});
