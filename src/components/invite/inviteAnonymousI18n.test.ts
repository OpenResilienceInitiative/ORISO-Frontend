import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Invite + anonymous waiting/consent used to pass German or English strings
 * as i18next fallbacks. When a key was missing or emptied, the UI snapped
 * to one language instead of the `fallbackLng` chain (ORISO-Frontend#1154).
 */
const INVITE_ANONYMOUS_FILES = [
	'src/components/invite/InviteLink.tsx',
	'src/components/login/LoginSecurityExplainer.tsx',
	'src/components/pseudonym/AnonymousConsentGate.tsx',
	'src/components/pseudonym/LeaveQueueDialog.tsx',
	'src/components/pseudonym/WaitingQueueActionBar.tsx',
	'src/components/pseudonym/PseudonymActionBar.tsx',
	'src/components/pseudonym/ConsultantAcceptedActionBar.tsx'
];

const ONE_LANGUAGE_T_FALLBACKS = [
	/'Name ändern'/,
	/'Registrierung läuft\.\.\.'/,
	/'Anmeldedaten erfassen'/,
	/'Um Ihre Anonymität zu schützen/,
	/'User-ID'/,
	/'Anonymer Login-Name/,
	/'Passwort'/,
	/'Bitte kopieren Sie das Passwort/,
	/'Weiter mit Auswahl'/,
	/'This invite link can no longer be used'/,
	/'Invite link could not be used'/,
	/'Missing token'/,
	/'Schaubild: Ihre Nachricht geht verschlüsselt/,
	/'Herzlich Willkommen'/,
	/'Danach kann eine beratende Person einen Chat/,
	/'Ich stimme nicht zu'/,
	/'Ich bin einverstanden'/,
	/'Um fortzufahren müssen Sie unseren Datenschutzbestimmungen/,
	/'Chat verlassen\?'/,
	/'Eine beratende Person wartet bereits/,
	/'Sie sind noch im Wartebereich/,
	/'Ihr Zugang wird deaktiviert/,
	/'Abbrechen'/,
	/'Ja, endgültig löschen'/,
	/'Im Wartebereich bleiben'/,
	/'Chat jetzt starten'/,
	/'Sobald eine beratende Person den Chat annimmt/,
	/'Chat beenden & Zugang löschen'/,
	/'Bis der Chat beginnt, eine kurze ruhige Begleitung/,
	/defaultValue:\s*'\{\{count\}\} Personen vor Ihnen'/,
	/'Wird verbunden …'/,
	/'Noch vor Ihnen'/,
	/'Wartebereich-Aktionen'/,
	/'Bis der Chat beginnt, eine kurze'/,
	/'interaktive ruhige Begleitung\.'/,
	/'Kurze ruhige Begleitung öffnen'/,
	/'Statt zu warten'/,
	/'Mail Beratung starten'/,
	/'Chat verlassen'/,
	/'Pseudonym-Aktionen'/,
	/'Sie werden jetzt von ihrer Berater_in/,
	/'Hinweis ausblenden'/,
	/'Jetzt Chat starten'/
];

describe('invite and anonymous waiting have no one-language t() fallbacks (#1154)', () => {
	it.each(INVITE_ANONYMOUS_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');

		const hits = ONE_LANGUAGE_T_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});

	it('ships inviteLink.error keys in every UI locale', () => {
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
			) as {
				inviteLink?: { error?: Record<string, string> };
			};
			expect(catalogue.inviteLink?.error?.title).toBeTruthy();
			expect(catalogue.inviteLink?.error?.generic).toBeTruthy();
			expect(catalogue.inviteLink?.error?.missingToken).toBeTruthy();
		}
	});
});
