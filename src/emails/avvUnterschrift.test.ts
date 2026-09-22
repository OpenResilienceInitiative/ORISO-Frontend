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

	// Frank, 2026-09-23: the mail says "Vertragsunterlagen" / "contract
	// documents", never "AVV" or "Auftragsverarbeitungsvertrag".
	it.each(EMAIL_LOCALES)(
		'%s never says AVV or Auftragsverarbeitungsvertrag',
		(locale) => {
			const mail = buildEmail('avv-unterschrift', locale, {
				dialect: 'plain'
			});
			for (const part of [
				mail.subject,
				mail.preheader,
				mail.html,
				mail.text
			]) {
				expect(part).not.toMatch(
					/AVV|Auftragsverarbeitungsvertrag|data processing agreement/i
				);
			}
		}
	);

	it.each([
		[
			'de-sie',
			'Ohne unterzeichnete Vertragsunterlagen bleibt die Beratung für diesen Träger gesperrt.'
		],
		[
			'de-du',
			'Ohne unterzeichnete Vertragsunterlagen bleibt die Beratung für diesen Träger gesperrt.'
		],
		[
			'en',
			'Without signed contract documents, counselling stays blocked for this organisation.'
		]
	] as const)('%s keeps the blocked-counselling line', (locale, line) => {
		const { html, text } = buildEmail('avv-unterschrift', locale, {
			dialect: 'plain'
		});
		expect(html).toContain(line);
		expect(text).toContain(line);
	});

	// The Träger brands the header (`platformName`), but "X ist ein Angebot
	// von Y" describes the platform — X must be a value no sender overlays
	// with a Träger name.
	it.each(EMAIL_LOCALES)(
		'%s names the platform, not the header brand, in the offered-by line',
		(locale) => {
			const { html, text } = buildEmail('avv-unterschrift', locale, {
				dialect: 'plain'
			});
			const offeredBy =
				locale === 'en'
					? '{{offeringName}} is a service provided by {{orgName}}.'
					: '{{offeringName}} ist ein Angebot von {{orgName}}.';
			expect(html).toContain(offeredBy);
			expect(text).toContain(offeredBy);
			expect(html).not.toMatch(
				/\{\{platformName\}\} (ist ein Angebot|is a service)/
			);
		}
	);

	// "zwischen … und" takes the dative: a sender without a Träger name
	// writes "Ihrer Organisation" there, while the subject keeps "für Ihre".
	it.each(['de-sie', 'de-du'] as const)(
		'%s names the Träger in the dative in the fine print',
		(locale) => {
			const { html, text } = buildEmail('avv-unterschrift', locale, {
				dialect: 'plain'
			});
			const finePrint =
				'Diese E-Mail gehört zum Vertragsverhältnis zwischen {{orgName}} und {{tenantNameDative}}.';
			expect(html).toContain(finePrint);
			expect(text).toContain(finePrint);
		}
	);
});
