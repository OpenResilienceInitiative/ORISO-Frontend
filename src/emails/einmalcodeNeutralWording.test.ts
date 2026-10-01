import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMAIL_CONTENT, EMAIL_LOCALES, buildEmail } from './index';

/**
 * The one-time-code mail is sent both when someone signs in and when someone
 * sets up email two-factor login. Its copy therefore must not assume sign-in,
 * and it must not tell people to change their password (FE#1415 intent).
 */
const NEUTRAL = {
	'en': {
		subject: 'Your one-time code',
		paragraph: 'Enter this code in {{platformName}}.',
		footnote: 'If you did not request this code, you can ignore this email.'
	},
	'de-sie': {
		subject: 'Ihr Einmalcode',
		paragraph: 'Geben Sie diesen Code in {{platformName}} ein.',
		footnote:
			'Wenn Sie diesen Code nicht angefordert haben, können Sie diese E-Mail ignorieren.'
	},
	'de-du': {
		subject: 'Dein Einmalcode',
		paragraph: 'Gib diesen Code in {{platformName}} ein.',
		footnote:
			'Wenn du diesen Code nicht angefordert hast, kannst du diese E-Mail ignorieren.'
	}
} as const;

/** The sign-in-only wording that `dev` carried before this fix, per locale. */
const OLD_FOOTNOTES = [
	'If you did not want to sign in, please change your password.',
	'Wenn Sie sich nicht anmelden wollten, ändern Sie bitte Ihr Passwort.',
	'Wenn du dich nicht anmelden wolltest, ändere bitte dein Passwort.',
	'Si vous ne vouliez pas vous connecter, changez votre mot de passe.',
	'Если Вы не собирались входить, пожалуйста, смените пароль.',
	'ክትኣትዉ ዘይደለኹም እንተኾይኑ፣ በጃኹም መሕለፊ ቃልኩም ቀይሩ።',
	'Giriş yapmak istemediyseniz lütfen şifrenizi değiştirin.'
];

describe('one-time-code mail wording', () => {
	it.each(Object.entries(NEUTRAL))(
		'%s names no purpose and does not ask for a password change',
		(locale, expected) => {
			const copy =
				EMAIL_CONTENT[locale as keyof typeof NEUTRAL].einmalcode;
			expect(copy.subject).toBe(expected.subject);
			expect(copy.paragraphs).toEqual([expected.paragraph]);
			expect(copy.footnote).toBe(expected.footnote);
		}
	);

	it.each(EMAIL_LOCALES)(
		'%s no longer carries the sign-in-only footnote in the rendered mail',
		(locale) => {
			const mail = buildEmail('einmalcode', locale);
			for (const old of OLD_FOOTNOTES) {
				expect(mail.html).not.toContain(old);
				expect(mail.text).not.toContain(old);
			}
		}
	);

	it.each(['en', 'de', 'fr', 'ru', 'ti', 'tr'])(
		'the generated Keycloak bundle (%s) ships the neutral footnote',
		(lang) => {
			const properties = readFileSync(
				path.resolve(
					__dirname,
					`dist/keycloak/email/messages/messages_${lang}.properties`
				),
				'utf8'
			);
			for (const old of OLD_FOOTNOTES) {
				expect(properties).not.toContain(`orisoOtpFootnote=${old}`);
			}
		}
	);

	it('the English and German Keycloak bundles say exactly the neutral text', () => {
		const read = (lang: string) =>
			readFileSync(
				path.resolve(
					__dirname,
					`dist/keycloak/email/messages/messages_${lang}.properties`
				),
				'utf8'
			);
		expect(read('en')).toContain(
			`\norisoOtpFootnote=${NEUTRAL.en.footnote}\n`
		);
		expect(read('de')).toContain(
			`\norisoOtpFootnote=${NEUTRAL['de-sie'].footnote}\n`
		);
	});
});
