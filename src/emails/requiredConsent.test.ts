import { describe, expect, it } from 'vitest';
import { buildEmail, EMAIL_LOCALES } from './index';

describe('required personal consent mail', () => {
	it.each(EMAIL_LOCALES)(
		'%s offers protected consent without an unrelated email opt-out',
		(locale) => {
			const mail = buildEmail('uebergabe-angefragt', locale);
			expect(mail.html).toContain('href="{{requestUrl}}"');
			expect(mail.text).toContain('{{requestUrl}}');
			expect(mail.html + mail.text).not.toContain('{{unsubscribeUrl}}');
			expect(mail.html + mail.text).not.toContain('{{settingsUrl}}');
			expect(mail.html + mail.text).not.toMatch(
				/{{(?:consultantName|caseReference|requestTopic|askerName)}}/
			);
		}
	);
	it.each(EMAIL_LOCALES)(
		'%s keeps the optional incoming-counsellor confirmation separate',
		(locale) => {
			const mail = buildEmail('uebergabe-bestaetigt', locale);
			expect(mail.html + mail.text).toContain('{{unsubscribeUrl}}');
			expect(mail.html + mail.text).toContain('{{settingsUrl}}');
		}
	);
});
