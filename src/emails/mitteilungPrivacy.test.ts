import { describe, expect, it } from 'vitest';
import { EMAIL_LOCALES, buildEmail } from './index';

describe('automatic message to a seeker', () => {
	it.each(EMAIL_LOCALES)(
		'%s keeps automatic message content out of the designed title and preview',
		(locale) => {
			const mail = buildEmail('mitteilung', locale);
			expect(mail.subject).toContain('{{platformName}}');
			expect(mail.subject).not.toMatch(
				/{{message(?:Subject|Preview|Headline|Body)}}/
			);
			expect(mail.preheader).not.toContain('{{');
			expect(mail.preheader.trim()).not.toBe('');
			expect(mail.html).toContain('{{messageBody}}');
			expect(mail.text).toContain('{{messageBody}}');
		}
	);
});
