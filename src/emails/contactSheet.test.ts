import { describe, expect, it } from 'vitest';
import { EMAIL_CONTENT, EMAIL_LOCALES, buildEmail } from './index';

describe('requested contact sheet', () => {
	it.each(EMAIL_LOCALES)(
		'%s uses the protected chat without an invented booking URL',
		(locale) => {
			const content = EMAIL_CONTENT[locale]['beraterin-kontakt'];
			expect(content.secondaryAction).toBeUndefined();
			expect(content.footnote).toBeUndefined();
			const mail = buildEmail('beraterin-kontakt', locale);
			for (const part of [mail.html, mail.text]) {
				expect(part).toContain('{{messageUrl}}');
				expect(part).not.toContain('{{bookingUrl}}');
			}
			expect(mail.preheader).not.toContain('{{bookingUrl}}');
		}
	);
});
