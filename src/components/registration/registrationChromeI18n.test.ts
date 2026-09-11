import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Signup chrome used to pass German strings as i18next `defaultValue` /
 * positional fallbacks. When a key was missing or emptied, the UI snapped
 * to German instead of the `fallbackLng` chain (ORISO-Frontend#1154).
 */
const SIGNUP_CHROME_FILES = [
	'src/components/registration/registrationHeader/RegistrationHeader.tsx',
	'src/components/registration/registrationStepper/RegistrationStepper.tsx',
	'src/components/stepper/molecules/CompactStepRow.tsx',
	'src/components/registration/zipcodeInput/ZipcodeInput.tsx',
	'src/components/registration/accountData/ConsentSentence.tsx',
	'src/components/registration/accountData/DataProtectionConsentLabel.tsx',
	'src/components/registration/Registration.tsx'
];

const GERMAN_T_FALLBACKS = [
	/fallback:\s*'Thema wählen'/,
	/fallback:\s*'Fokus wählen'/,
	/t\(\s*'registration\.headline',\s*'Registrierung'/,
	/defaultValue:\s*'Schritt \{\{current\}\}/,
	/defaultValue:\s*'Noch \{\{count\}\} Ziffern'/,
	/defaultValue:\s*'\{\{label\}\} entfernen'/,
	/defaultValue:\s*'Postleitzahl, Ziffer/,
	/t\(\s*'registration\.zipcode\.headline',\s*'Wo suchen Sie Beratung\?'/,
	/'Nur Ihre Postleitzahl — mehr brauchen wir nicht\.'/,
	/Die Datenschutzhinweise können derzeit nicht geladen werden/,
	/Der Einwilligungstext wird geladen/,
	/Der Einwilligungstext dieser Beratungsstelle kann derzeit nicht angezeigt werden/,
	/Maschinell übersetzt — rechtlich verbindlich/,
	/Dieser Text liegt nicht in Ihrer Sprache vor/,
	/Für Authentifizierung und Navigation verwendet diese Webseite Cookies/
];

describe('registration chrome has no German t() fallbacks (#1154)', () => {
	it.each(SIGNUP_CHROME_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');

		const hits = GERMAN_T_FALLBACKS.filter((pattern) => pattern.test(src));
		expect(hits.map(String)).toEqual([]);
	});
});
