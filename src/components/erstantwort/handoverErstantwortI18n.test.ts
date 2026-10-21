import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Registration handover and Erstantwort chrome used to pass German or
 * English strings as i18next fallbacks. Missing keys then snapped to one
 * language instead of the `fallbackLng` chain (ORISO-Frontend#1154).
 */
const SLICE_FILES = [
	'src/components/app/registrationLoader/RegistrationHandover.tsx',
	'src/components/app/registrationLoader/HandoverGateButton.tsx',
	'src/components/app/registrationLoader/handoverGate.ts',
	'src/components/erstantwort/SaveCredentialsCard.tsx',
	'src/components/erstantwort/NotificationChoiceCard.tsx',
	'src/components/erstantwort/ErstantwortEmailOverlay.tsx',
	'src/components/erstantwort/erstantwortResolve.ts'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'Registriert'/,
	/'Geschafft\.'/,
	/'So geht es weiter:'/,
	/'Anfrage schreiben'/,
	/'Verschlüsselt: Nur Sie und die Mitarbeiterinnen/,
	/'Beratungsraum wird verschlüsselt/,
	/'Prüfung: Mensch oder Bot/,
	/'Gleich sind Sie an der Reihe/,
	/'Alles bereit — Sie können schreiben'/,
	/'Das dauert länger als gewohnt'/,
	/'Ihr Beratungsraum wird geöffnet/,
	/'Anmeldename'/,
	/'Kopieren'/,
	/'Anmeldename kopiert\.'/,
	/'Kopieren hat nicht geklappt/,
	/'Wenn andere dieses Gerät mitbenutzen/,
	/'Passwort jetzt setzen'/,
	/'Schreiben Sie mir eine E-Mail'/,
	/'Geben Sie mir hier ein Signal'/,
	/'Beides, und Passwort jetzt selbst festlegen'/,
	/'E-mail'/,
	/'This e-mail address is already registered\.'/,
	/'Saving failed\. Please try again\.'/,
	/'Your e-mail address has been saved\.'/,
	/'Add an e-mail address'/,
	/'Close'/,
	/'Save'/,
	/translate\(entry\.bodyKey,\s*entry\.defaultBody\)/,
	/translate\(entry\.headlineKey,\s*entry\.defaultHeadline\)/,
	/entry\.action\.defaultLabel/
];

describe('handover and Erstantwort chrome have no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});
});
