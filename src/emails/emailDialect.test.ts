/* eslint-disable no-template-curly-in-string --
 * This module's entire job is to emit `${...}` as *literal text* for Thymeleaf
 * and FreeMarker. Every occurrence flagged by this rule is intended output, not
 * a JavaScript template literal someone forgot to backtick.
 */
import { describe, expect, it } from 'vitest';
import { EMAIL_DIALECTS, EMAIL_IDS, EMAIL_LOCALES, buildEmail } from './index';
import { emailLogoCell } from './kit/emailAtoms';
import { toEmailDialectHtml, toEmailDialectText } from './kit/emailDialect';
import { emailDefaultBrand, emailSampleBrand } from './kit/emailTokens';

/**
 * The dialects exist so that MailService and the Keycloak theme can render the
 * same mail Storybook shows. Whether they *do* is checked against the real Java
 * engines (see ORISO-Frontend#859); what is checked here is the property that
 * makes that possible — that the rewrite touches placeholders and nothing else.
 */
describe('e-mail template dialects', () => {
	it('leaves plain placeholders exactly as rendered', () => {
		const html = '<a href="{{resetUrl}}">{{username}}</a>';
		expect(toEmailDialectHtml(html, 'plain')).toBe(html);
	});

	describe('plain', () => {
		it('folds the placeholder-brand logo cell into {{logoCell}}', () => {
			// The template cannot express "logo only when configured", so the
			// plain dialect ships the whole cell as one token for the consumer
			// to expand — or drop, when no logo URL is set.
			const html = `<tr>${emailLogoCell(emailDefaultBrand)}<td>x</td></tr>`;
			expect(toEmailDialectHtml(html, 'plain')).toBe(
				'<tr>{{logoCell}}<td>x</td></tr>'
			);
		});

		it('keeps a concrete brand logo cell untouched', () => {
			// Previews render with real brand values; only the send-ready
			// placeholder markup is folded.
			const html = `<tr>${emailLogoCell(emailSampleBrand)}<td>x</td></tr>`;
			expect(toEmailDialectHtml(html, 'plain')).toBe(html);
		});
	});

	describe('thymeleaf', () => {
		it('inlines a placeholder that sits in a text node', () => {
			expect(
				toEmailDialectHtml('<td>Hallo {{username}}</td>', 'thymeleaf')
			).toBe('<td>Hallo [[${username}]]</td>');
		});

		it('gives an attribute a th:* twin and keeps the original', () => {
			expect(
				toEmailDialectHtml('<a href="{{resetUrl}}">x</a>', 'thymeleaf')
			).toBe('<a href="{{resetUrl}}" th:href="|${resetUrl}|">x</a>');
		});

		it('uses literal substitution, so a style attribute survives its commas', () => {
			const out = toEmailDialectHtml(
				'<a style="font-family:Inter, Arial;color:{{primaryColor}};">x</a>',
				'thymeleaf'
			);
			expect(out).toContain(
				'th:style="|font-family:Inter, Arial;color:${primaryColor};|"'
			);
		});

		it('does not mistake body copy for a parked tag', () => {
			// The tag placeholder used internally must not collide with text
			// like "24 Stunden" — which is in the password-reset copy.
			expect(
				toEmailDialectHtml(
					'<p>Der Link gilt 24 Stunden.</p>',
					'thymeleaf'
				)
			).toBe('<p>Der Link gilt 24 Stunden.</p>');
		});

		it('rejects a placeholder in an attribute it cannot express', () => {
			expect(() =>
				toEmailDialectHtml('<td data-x="{{oops}}">y</td>', 'thymeleaf')
			).toThrow(/no Thymeleaf mapping/);
		});
	});

	describe('freemarker', () => {
		it('escapes in HTML and defaults a missing variable to empty', () => {
			expect(
				toEmailDialectHtml('<td>{{username}}</td>', 'freemarker')
			).toBe("<td>${(username!'')?html}</td>");
		});

		it('does not escape in the plain-text part', () => {
			expect(toEmailDialectText('Hallo {{username}}', 'freemarker')).toBe(
				"Hallo ${username!''}"
			);
		});

		it('refuses markup FreeMarker would try to interpret', () => {
			expect(() =>
				toEmailDialectHtml('<td>${x}</td>', 'freemarker')
			).toThrow(/would try to interpret/);
		});
	});

	describe('every generated mail', () => {
		const cases = EMAIL_DIALECTS.flatMap((dialect) =>
			EMAIL_LOCALES.flatMap((locale) =>
				EMAIL_IDS.map((id) => ({ dialect, locale, id }))
			)
		);

		it.each(cases)(
			'$dialect/$locale/$id carries no unconverted placeholder in its text',
			({ dialect, locale, id }) => {
				const { html, text } = buildEmail(id, locale, { dialect });
				// Attributes deliberately keep the literal `{{…}}` as
				// documentation, so only text nodes are checked here.
				const textNodes = html.replace(/<[^>]*>/g, '');
				if (dialect === 'plain') {
					expect(textNodes).toContain('{{');
				} else {
					expect(textNodes).not.toContain('{{');
					expect(text).not.toContain('{{');
				}
			}
		);

		it.each(cases)(
			'$dialect/$locale/$id places the logo the way its consumer expects',
			({ dialect, locale, id }) => {
				const { html } = buildEmail(id, locale, { dialect });
				if (dialect === 'plain') {
					// UserService expands {{logoCell}} at send time — full
					// cell when a logo URL is configured, nothing when blank.
					expect(html).toContain('<tr>{{logoCell}}<td');
					expect(html).not.toContain('{{logoUrl}}');
				} else {
					// The template engines have real conditionals available;
					// their templates keep the literal cell.
					expect(html).not.toContain('logoCell');
					expect(html).toContain('logoUrl');
				}
			}
		);
	});
});
