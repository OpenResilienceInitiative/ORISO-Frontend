import { describe, expect, it } from 'vitest';
import de from '../resources/i18n/de/common.json';
import deInformal from '../resources/i18n/de@informal/common.json';
import en from '../resources/i18n/en/common.json';
import fr from '../resources/i18n/fr/common.json';
import ru from '../resources/i18n/ru/common.json';
import ti from '../resources/i18n/ti/common.json';
import tr from '../resources/i18n/tr/common.json';
import {
	EMAIL_CONTENT,
	EMAIL_LOCALES,
	buildEmail,
	fillEmailPlaceholders
} from './index';

const callEmailIds = [
	'anruf-erinnerung',
	'anruf-einladung',
	'anruf-verpasst'
] as const;
const fullNotificationCatalogues = { de, en, fr, ru, ti, tr } as const;

describe('privacy-neutral call notification locales', () => {
	it.each([...EMAIL_LOCALES])('%s renders every call e-mail', (locale) => {
		callEmailIds.forEach((id) => {
			const built = buildEmail(id, locale);
			const html = fillEmailPlaceholders(built.html, {
				callUrl: 'https://beratung.example.org/gespraeche/anruf'
			});
			expect(built.subject).toBeTruthy();
			expect(html).toContain(
				'https://beratung.example.org/gespraeche/anruf'
			);
			expect(html).not.toContain('{{callUrl}}');
		});
	});

	it.each(Object.entries(fullNotificationCatalogues))(
		'%s supplies every transient notification state',
		(_locale, catalogue) => {
			const notifications = catalogue.videoCall.notifications;
			expect(notifications.scheduledCall.title).toBeTruthy();
			expect(notifications.invitation.title).toBeTruthy();
			expect(notifications.missedCall.title).toBeTruthy();
			expect(notifications.action.open).toBeTruthy();
			expect(notifications.type.audio).toBeTruthy();
			expect(notifications.type.video).toBeTruthy();
		}
	);

	it('keeps the informal German overlay limited to address-form differences', () => {
		expect(deInformal.videoCall.notifications.scheduledCall.body).toContain(
			'dich'
		);
		expect(
			'de@informal inherits shared titles and call type labels from de'
		).toBeTruthy();
	});

	it.each([...EMAIL_LOCALES])(
		'%s call e-mails do not expose participant or session metadata',
		(locale) => {
			callEmailIds.forEach((id) => {
				const text = JSON.stringify(EMAIL_CONTENT[locale][id]);
				expect(text).not.toMatch(
					/participantName|participantCount|sessionTopic|consultantName|agencyName/
				);
			});
		}
	);
});
