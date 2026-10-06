import { describe, expect, it } from 'vitest';
import {
	EMAIL_CLASS,
	EMAIL_LOCALES,
	buildEmail,
	emailIsUnsubscribable,
	getEmailContent
} from './index';

describe('existing account password setup mail', () => {
	it.each(EMAIL_LOCALES)(
		'%s has one protected setup action and neutral configured branding',
		(locale) => {
			const content = getEmailContent('konto-einrichten', locale);
			const mail = buildEmail('konto-einrichten', locale);
			expect(content.cta?.href).toBe('{{setupUrl}}');
			expect(mail.subject).toContain('{{platformName}}');
			expect(mail.preheader.trim()).not.toBe('');
			expect(mail.preheader).not.toContain('{{');
			expect(mail.html).toContain('href="{{setupUrl}}"');
			expect(mail.text).toContain('{{setupUrl}}');
			expect(mail.html).toContain('{{offeringName}}');
			expect(mail.html).toContain('{{operatorName}}');
			expect(mail.text).toContain('{{orgName}}');
			expect(
				`${mail.subject}\n${mail.preheader}\n${mail.html}\n${mail.text}`
			).not.toMatch(
				/\{\{(?:password|temporaryPassword|username|firstName|lastName|tenantName|agencyName|requestTopic|caseReference)\}\}|ORISO|Sunflower|Stalwart/
			);
			expect(mail.html).not.toContain('{{unsubscribeUrl}}');
			expect(mail.text).not.toContain('{{unsubscribeUrl}}');
		}
	);

	it('uses the existing non-switchable security classification', () => {
		expect(EMAIL_CLASS['konto-einrichten']).toBe('security');
		expect(emailIsUnsubscribable('konto-einrichten')).toBe(false);
	});
});
