import { describe, expect, it } from 'vitest';
import { buildEmail, EMAIL_LOCALES } from './index';

describe.each(EMAIL_LOCALES)('security mail policy in %s', (locale) => {
	it.each(['passwort-zuruecksetzen', 'email-geaendert'] as const)(
		'keeps %s free of notification preference and unsubscribe links',
		(id) => {
			const mail = buildEmail(id, locale);
			for (const part of [mail.html, mail.text]) {
				expect(part).not.toContain('{{unsubscribeUrl}}');
				expect(part).not.toContain('{{settingsUrl}}');
				expect(part).toContain('{{privacyUrl}}');
				expect(part).toContain('{{imprintUrl}}');
			}
		}
	);
});
