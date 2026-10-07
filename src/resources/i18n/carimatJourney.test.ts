import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import de from './de/common.json';
import informal from './de@informal/common.json';
import en from './en/common.json';
import fr from './fr/common.json';
import ru from './ru/common.json';
import tr from './tr/common.json';
import ti from './ti/common.json';
import { resolveErstantwortBausteine } from '../../components/erstantwort/erstantwortResolve';

const requestSwitchLabels: Record<string, string> = {
	'de': 'Zugriff für diese Anfrage erlauben',
	'de@informal': 'Zugriff für diese Anfrage erlauben',
	'en': 'Allow access for this request',
	'fr': 'Autoriser l’accès pour cette demande',
	'ru': 'Разрешить доступ для этого запроса',
	'tr': 'Bu talep için erişime izin ver',
	'ti': 'ነዚ ሕቶ መእተዊ ፍቐዱ'
};

const catalogues = { de, 'de@informal': informal, en, fr, ru, tr, ti };
const leafKeys = (value: unknown, prefix = ''): string[] =>
	Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
		typeof child === 'string'
			? [`${prefix}${key}`]
			: leafKeys(child, `${prefix}${key}.`)
	);
const journeyKeys = [
	...leafKeys(de.caseHandover.consent, 'caseHandover.consent.'),
	...leafKeys(de.erstantwort, 'erstantwort.'),
	...leafKeys(de.furtherSteps.email, 'furtherSteps.email.'),
	...leafKeys(de.caseHandover.accepted, 'caseHandover.accepted.'),
	'caseHandover.systemMessage.selectedReason',
	'caseHandover.systemMessage.explanation',
	'profile.notifications.noEmail.modal.errorMessage',
	'app.close',
	'message.menu.open',
	'message.deliveryStatus.sent'
].filter((key) => key !== 'erstantwort.freeNotice.body');

describe('Carimat journey in each supported language (#1660)', () => {
	it.each(Object.entries(catalogues))(
		'%s resolves its own journey without German fallback',
		async (locale, catalogue) => {
			const language = createInstance();
			await language.init({
				lng: locale,
				fallbackLng: false,
				resources: { [locale]: { translation: catalogue } }
			});
			for (const key of journeyKeys) {
				expect(language.exists(key), `${locale}: ${key}`).toBe(true);
				expect(language.t(key), `${locale}: ${key}`).not.toBe(key);
			}
			expect(language.t('caseHandover.consent.optOut.switchLabel')).toBe(
				requestSwitchLabels[locale]
			);
			const deadline = language.t('erstantwort.responseDeadline.body', {
				deadlineDays: 7
			});
			expect(deadline).toContain('7');
			expect(deadline).not.toContain('{{');
			const reason = language.t(
				'caseHandover.systemMessage.selectedReason',
				{ reason: 'TEST_REASON' }
			);
			expect(reason).toContain('TEST_REASON');
			const accepted = language.t('caseHandover.accepted.copy', {
				advisor: 'TEST_ADVISOR',
				organisation: 'TEST_AGENCY'
			});
			expect(accepted).toContain('TEST_ADVISOR');
			expect(accepted).toContain('TEST_AGENCY');
			const active = language.t('erstantwort.notificationChoice.active', {
				channel: 'EMAIL_TEST'
			});
			expect(active).toContain('EMAIL_TEST');
			expect(active).not.toContain('{{');
			const sequence = resolveErstantwortBausteine({
				trigger: 'AFTER_FIRST_MESSAGE',
				translate: (key) => language.t(key),
				state: {
					hasEmail: false,
					isTwoFactorActive: false,
					isTwoFactorEnabled: true
				}
			});
			expect(sequence.status).toBe('ok');
			expect(sequence.bausteine.length).toBeGreaterThan(0);
			for (const bubble of sequence.bausteine) {
				expect(bubble.body).not.toMatch(
					/^(erstantwort|furtherSteps)\./
				);
			}
		}
	);
});
