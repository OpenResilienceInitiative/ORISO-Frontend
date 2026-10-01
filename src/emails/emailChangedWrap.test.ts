import { describe, expect, it } from 'vitest';
import { EMAIL_CONTENT, EMAIL_LOCALES, EMAIL_LOCALE_LANG } from './index';
import { emailDefaultBrand } from './kit/emailTokens';
import { renderEmailHtml } from './kit/emailTemplate';

describe('changed-address mail with a long readable login', () => {
	it.each(EMAIL_LOCALES)(
		'%s keeps the escaped login inside a wrapping prose cell',
		(locale) => {
			const content = EMAIL_CONTENT[locale]['email-geaendert'];
			const longLogin = `${'readable'.repeat(36)}<script>`;
			const html = renderEmailHtml(
				{
					...content,
					paragraphs: content.paragraphs.map((paragraph) =>
						paragraph.replace('{{username}}', longLogin)
					)
				},
				{ brand: emailDefaultBrand, lang: EMAIL_LOCALE_LANG[locale] }
			);

			const loginAt = html.indexOf(
				`${'readable'.repeat(36)}&lt;script&gt;`
			);
			expect(loginAt).toBeGreaterThan(0);
			expect(html).not.toContain('<script>');
			const paragraphCell = html.slice(
				html.lastIndexOf('<td', loginAt),
				loginAt
			);
			expect(paragraphCell).toContain('word-break:break-word');
		}
	);
});
