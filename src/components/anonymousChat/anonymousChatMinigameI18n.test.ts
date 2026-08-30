import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Anonymous chat + waiting-room mini-game used to pass German or English
 * strings as i18next fallbacks. When a key was missing or emptied, the UI
 * snapped to one language instead of the `fallbackLng` chain (#1154).
 */
const SLICE_FILES = [
	'src/components/anonymousChat/AnonymousChat.tsx',
	'src/components/anonymousChat/liveChatOpeningHours.ts',
	'src/components/pseudonym/BreathingTutorialCard.tsx',
	'src/components/session/SessionItemComponent.tsx'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'Anonyme Beratung'/,
	/'Wählen Sie eine Beratungsstelle/,
	/'Benutzername'/,
	/'Dieser Benutzername wurde automatisch generiert'/,
	/'Passwort kopiert'/,
	/'Das Passwort wurde in die Zwischenablage/,
	/'Beratungsthemen und Beratungsstellen wählen'/,
	/'Keine Beratungsthemen verfügbar'/,
	/'Für dieses Thema sind keine Beratungsstellen/,
	/'Diese Beratungsstelle berät Sie auf:'/,
	/'Zurück'/,
	/'Registrierung läuft\.\.\.'/,
	/'Beratung starten'/,
	/'Live-Chat ist zurzeit leider geschlossen'/,
	/'Wenn Sie ohne Registrierung beraten werden/,
	/'Reguläre Öffnungszeiten anzeigen'/,
	/'Oder starten Sie jederzeit die anonyme Mail-Beratung/,
	/'Tipp: Nutzen Sie eine E-Mail-Adresse/,
	/'anonyme Mail-Beratung starten'/,
	/'Antwort innerhalb von 2 Werktagen'/,
	/'Zurück zur vorherigen Seite'/,
	/'Später wiederkommen'/,
	/'Angefragtes Thema:/,
	/'Inhale'/,
	/'Hold'/,
	/'Exhale'/,
	/'You need to 3 things/,
	/'through your nose'/,
	/'your breath'/,
	/'through your mouth'/,
	/'Lets bridge your waiting time'/,
	/'Got it, lets start'/,
	/'Ratsuchende_r 9'/,
	/'Bitte haben Sie etwas Geduld'/,
	/'Derzeit sind alle Berater_innen/,
	/'Ihr Benutzername lautet:'/,
	/'Um Ihre Anonymität zu schützen, löschen wir/,
	/'Sie benötigen nicht sofort eine Antwort/,
	/'Registrieren Sie sich und hinterlassen Sie uns/,
	/'Gehen Sie zur Registrierung'/,
	/'Wollen Sie die Wartezeit sinnvoll nutzen/,
	/'Dann spielen Sie in der Zwischenzeit/,
	/'Spiel starten'/,
	/'Achievement unlocked:/,
	/'Choose your pace/,
	/'Inhale slowly for/,
	/'Hold your breath now/,
	/'Exhale slowly for/,
	/'Great lets inhale/,
	/'Set this time your own time intervals/,
	/'Congratulation you have made it'/,
	/'The gift is a little mantra/,
	/'Great job, want to start now/,
	/'Just arrive. We breathe together'/,
	/'When you are ready, start your first try'/,
	/'Level \{\{level\}\}: \{\{title\}\}'/,
	/'Your main prize is true wisdom'/,
	/'Because you overcame your inner noise/,
	/'God, grant me the serenity/,
	/'Inhale exhale breathing guide'/,
	/'Time left'/,
	/'For better experience, turn on your volume'/,
	/'Set your breathing timing/,
	/'Decrease inhale seconds'/,
	/'Lets start the first try'/,
	/'Repeat training round'/,
	/'Lets start the real game'/,
	/'I change my mind/,
	/'I just wait'/,
	/'Start the game'/,
	/'Join the room'/,
	/'Auto pilot'/,
	/'Time it'/,
	/'Press at the right time'/,
	/'Repeat game'/,
	/'Receive little gift'/,
	/'Back to waiting'/
];

describe('anonymous chat and waiting mini-game have no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});

	it('ships weekday and topicLabel keys in every UI locale', () => {
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
				anonymousChat?: {
					noAvailability?: {
						topicLabel?: string;
						weekdays?: Record<string, string>;
					};
				};
			};
			const block = catalogue.anonymousChat?.noAvailability;
			expect(block?.topicLabel).toBeTruthy();
			for (const day of [
				'monday',
				'tuesday',
				'wednesday',
				'thursday',
				'friday'
			]) {
				expect(block?.weekdays?.[day]).toBeTruthy();
			}
		}
	});
});
