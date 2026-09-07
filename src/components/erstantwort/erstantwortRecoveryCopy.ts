import type { ResolvedBaustein } from './erstantwortResolve';
import type { ErstantwortRecoveryStep } from './ErstantwortRecoverySteps';

/**
 * Modul 3 — the words. Kept apart from the components so this file is exactly
 * what would be pasted into `erstantwortCatalogue.ts` if the module is adopted:
 * a Baustein shape with a headline, a body and an optional action, plus the
 * step texts the pager pages through.
 *
 * <h3>What the words are allowed to claim</h3>
 *
 * Every sentence below is checked against the shipped code, not against how the
 * feature is described elsewhere:
 *
 * - The key is **already created** when the person reads this. The login-time
 *   probe bootstraps it in the background (`KeyBackupRecoveryPrompt`), so
 *   "create your key" would be an instruction to redo something done.
 * - It is **shown in Profil → Einstellungen → Sicherheit**, and nowhere else.
 * - After the confirmation checkbox the parked copy is **deleted**, and the
 *   server never had it — so "we cannot show it again" is literally true.
 * - On a second device the app **asks by itself**; the person does not have to
 *   find a menu (`keyStorageOutOfSync` opens the recovery dialog).
 *
 * <h3>No crypto vocabulary</h3>
 *
 * "Megolm", "Secret Storage", "Cross-Signing", "Backup-Version" and "Tresor"
 * do not appear. The person is mid-Anfrage, not mid-onboarding for a security
 * product. Frank's vocabulary decision of 2026-08-14 stands: the thing is
 * called **Ersatzschlüssel**.
 */

export type ErstantwortRecoveryState = 'notSecured' | 'secured' | 'unsupported';

/**
 * The five steps. Each carries the brief for its illustration rather than an
 * illustration — the drawings are commissioned from this list.
 */
export const ERSTANTWORT_RECOVERY_STEPS: ErstantwortRecoveryStep[] = [
	{
		id: 'alreadyCreated',
		text: 'Ihr Ersatzschlüssel ist schon fertig. Wir haben ihn bei Ihrer ersten Anmeldung erzeugt — Sie mussten nichts tun.',
		illustrationBrief:
			'Ein Schlüssel, der neben dem angemeldeten Gerät von selbst entsteht — kein Formular, keine Eingabe.'
	},
	{
		id: 'openSecurity',
		text: 'Öffnen Sie Ihr Profil, dann Einstellungen und dort Sicherheit. Da wartet er auf Sie.',
		illustrationBrief:
			'Der Weg in drei Stationen: Profil → Einstellungen → Sicherheit, die letzte hervorgehoben.'
	},
	{
		id: 'copyKey',
		text: 'Dort steht eine Reihe aus Buchstaben und Zahlen. Ein Tipp auf „Schlüssel kopieren" genügt.',
		illustrationBrief:
			'Die Schlüsselzeile mit dem Kopieren-Knopf daneben; angedeutete Zeichen, kein echter Schlüssel.'
	},
	{
		id: 'storeKey',
		text: 'Legen Sie ihn sicher ab — im Passwort-Manager oder aufgeschrieben an einem Ort, den nur Sie kennen.',
		illustrationBrief:
			'Zwei gleichwertige Ablagen nebeneinander: Passwort-Manager und ein Zettel im Portemonnaie.'
	},
	{
		id: 'confirmStored',
		text: 'Setzen Sie zum Schluss den Haken „Ich habe den Schlüssel sicher gespeichert". Danach zeigen wir ihn nicht mehr an.',
		illustrationBrief:
			'Ein gesetzter Haken; daneben verblasst die Schlüsselzeile — sie ist ab jetzt nur noch bei Ihnen.'
	}
];

/**
 * The bubble text per state. Shaped as a `ResolvedBaustein` so the stories feed
 * the shipped `ErstantwortSequence` the same object a catalogue entry resolves
 * to — nothing here is a story-local imitation of a Baustein.
 *
 * `secured` deliberately keeps an action, but a different one: the parked copy
 * is gone, so "ansehen" would open a panel that has nothing to show. Changing
 * the key is what the Sicherheit panel actually offers in its healthy phase.
 * `unsupported` has no action at all.
 */
export const erstantwortRecoveryBaustein = (
	state: ErstantwortRecoveryState
): ResolvedBaustein => {
	switch (state) {
		case 'secured':
			return {
				id: 'recoveryKey',
				headline: 'Ihr Ersatzschlüssel ist gesichert',
				body: 'Sie haben Ihren Ersatzschlüssel gespeichert — mehr ist hier nicht zu tun. Melden Sie sich später auf einem anderen Gerät an, fragen wir einmal danach; dann ist Ihr bisheriger Verlauf auch dort wieder da. Noch einmal anzeigen können wir ihn nicht, denn wir haben ihn nirgends gespeichert.',
				action: {
					kind: 'SHOW_RECOVERY_KEY',
					label: 'Ersatzschlüssel ändern'
				}
			};
		case 'unsupported':
			return {
				id: 'recoveryKey',
				headline: 'Auf diesem Gerät ohne Verschlüsselung',
				body: 'Dieser Browser unterstützt die Verschlüsselung nicht, deshalb gibt es hier keinen Ersatzschlüssel. Ihre Beratung läuft ganz normal weiter. Wechseln Sie später auf ein Gerät, das die Verschlüsselung unterstützt, richten wir den Schlüssel dort von selbst ein.'
			};
		default:
			return {
				id: 'recoveryKey',
				headline: 'Auf diesem Gerät sind Sie sicher verschlüsselt',
				/* Reassurance first, limitation second — the order the shipped
				   `deviceLimit` Baustein already uses, and for the same reason:
				   the limitation alone reads as "you are about to lose
				   everything".

				   Three sentences, no more: the person is mid-Anfrage, and the
				   detail ("we already made the key for you") is step 1 of the
				   walkthrough right below. Saying it twice makes the bubble ten
				   lines long on a 390 pt screen. */
				body: 'Was Sie hier schreiben, kann nur auf diesem Gerät gelesen werden. Öffnen Sie das Gespräch später auf einem anderen Gerät, sehen Sie den bisherigen Verlauf dort zunächst nicht — mit Ihrem Ersatzschlüssel holen Sie ihn zurück. Sichern Sie ihn einmal, in fünf Schritten:',
				action: {
					kind: 'SHOW_RECOVERY_KEY',
					label: 'Ersatzschlüssel ansehen'
				}
			};
	}
};
