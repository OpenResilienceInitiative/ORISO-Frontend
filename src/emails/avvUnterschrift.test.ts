import { describe, expect, it } from 'vitest';
import { EMAIL_DIALECTS, EMAIL_LOCALES, buildEmail } from './index';

/**
 * The DPA signing mail (UserService sends it from the `plain` dialect). Its
 * link is a single-use contract link: a recipient whose client breaks the
 * button must still be able to copy it, and the inbox line must say which
 * Träger the contract is for.
 */
describe('avv-unterschrift', () => {
	const COPY_HINT = {
		'de-sie':
			'Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
		'de-du':
			'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
		'en': 'If the button does not work, copy this link into your browser:'
	} as const;

	it.each(EMAIL_LOCALES)(
		'%s offers the sign link as button and as visible copy-link fallback',
		(locale) => {
			const { html } = buildEmail('avv-unterschrift', locale, {
				dialect: 'plain'
			});
			expect(html).toContain(COPY_HINT[locale]);
			expect(html).toContain('>{{dpaUrl}}</a>');
			expect(html.split('href="{{dpaUrl}}"')).toHaveLength(3);
		}
	);

	it('names the Träger in the subject', () => {
		const subject = (locale: (typeof EMAIL_LOCALES)[number]) =>
			buildEmail('avv-unterschrift', locale, { dialect: 'plain' })
				.subject;
		expect(subject('de-sie')).toBe('Vertragsunterlagen für {{tenantName}}');
		expect(subject('de-du')).toBe('Vertragsunterlagen für {{tenantName}}');
		expect(subject('en')).toBe('Contract documents for {{tenantName}}');
	});

	it.each(EMAIL_DIALECTS)(
		'keeps the text part free of the hint, the URL line is the copy link (%s)',
		(dialect) => {
			const { text } = buildEmail('avv-unterschrift', 'de-sie', {
				dialect
			});
			expect(text).not.toContain(COPY_HINT['de-sie']);
		}
	);
});
