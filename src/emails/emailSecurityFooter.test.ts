import { describe, expect, it } from 'vitest';
import { buildEmail, EMAIL_LOCALES } from './index';

describe.each(EMAIL_LOCALES)('security mail policy in %s', (locale) => {
	it('keeps password reset free of notification preference and unsubscribe links', () => {
		const mail = buildEmail('passwort-zuruecksetzen', locale);
		for (const part of [mail.html, mail.text]) {
			expect(part).not.toContain('{{unsubscribeUrl}}');
			expect(part).not.toContain('{{settingsUrl}}');
			expect(part).toContain('{{privacyUrl}}');
			expect(part).toContain('{{imprintUrl}}');
		}
	});

	it('describes the email change as a security notice, not a sign-in event', () => {
		const mail = buildEmail('email-geaendert', locale);
		const notice =
			locale === 'en'
				? 'This is a security notice'
				: 'Diese E-Mail ist ein Sicherheitshinweis';
		expect(mail.html).toContain(notice);
		expect(mail.text).toContain(notice);
	});
});
