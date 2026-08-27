import { describe, expect, it } from 'vitest';
import manifest from './content/translationManifest.json';
import review from './content/translationReview.json';
import {
	EMAIL_CONTENT,
	EMAIL_IDS,
	EMAIL_LOCALES,
	EMAIL_LOCALE_DIR,
	EMAIL_LOCALE_LANG,
	EMAIL_LOCALE_PROVENANCE,
	EMAIL_LOCALE_RELEASE,
	EMAIL_RELEASED_LOCALES,
	EMAIL_SOURCE_LOCALE,
	EMAIL_TRANSLATED_LOCALES,
	EmailContent,
	EmailId,
	EmailTranslationManifest,
	EmailTranslationReview,
	emailFingerprint,
	emailOccasionFingerprint,
	emailProtectedStringIndex,
	emailReviewGaps,
	listEmailPlaceholders
} from './index';

/**
 * The guard behind ORISO-Frontend#1065.
 *
 * The app speaks six languages; the mails used to speak two. Adding the other
 * four is the easy half. The half that decides whether this holds up is what
 * happens *next* time somebody improves a German sentence — because the
 * failure mode of a translated mail is silent. Nothing throws when a French
 * mail says last month's thing. Nothing throws when a Tigrinya mail promises
 * encryption the platform does not provide.
 *
 * So this file is four rules:
 *
 *   1. every language has every occasion, with the same *shape*;
 *   2. every language interpolates exactly the same placeholders — a dropped
 *      `{{loginUrl}}` is a dead mail, an added `{{consultantName}}` is a
 *      privacy incident;
 *   3. the manifest still matches the copy, so German cannot move alone;
 *   4. a machine-translated language cannot be marked send-ready until the
 *      strings that make a claim have been read by a person.
 */

const source = EMAIL_CONTENT[EMAIL_SOURCE_LOCALE];
const typedManifest = manifest as EmailTranslationManifest;
const typedReview = review as unknown as EmailTranslationReview;

/** The shape of an occasion, independent of the words in it. */
const shapeOf = (content: EmailContent) => ({
	paragraphs: content.paragraphs.length,
	panel: content.panel?.length ?? null,
	code: content.code !== undefined,
	cta: content.cta !== undefined,
	secondaryAction: content.secondaryAction !== undefined,
	footnote: content.footnote !== undefined,
	footerLinks: content.footer.links.length
});

/** Every string an occasion is built from, in a stable order. */
const allText = (content: EmailContent): string[] => [
	content.subject,
	content.preheader,
	content.headline,
	...content.paragraphs,
	...(content.panel ?? []).flatMap((row) => [row.label, row.value]),
	...(content.code ? [content.code.label, content.code.value] : []),
	...(content.cta ? [content.cta.label, content.cta.href] : []),
	...(content.secondaryAction
		? [content.secondaryAction.label, content.secondaryAction.href]
		: []),
	content.footnote ?? '',
	content.assurance,
	content.footer.offeredBy,
	...content.footer.links.flatMap((link) => [link.label, link.href]),
	content.footer.automatedNote
];

/** Every `{{placeholder}}` an occasion interpolates. */
const placeholdersOf = (content: EmailContent): string[] =>
	listEmailPlaceholders(allText(content).join('\n')).sort();

const cases = EMAIL_TRANSLATED_LOCALES.flatMap((locale) =>
	EMAIL_IDS.map((id) => ({ locale, id }))
);

describe('e-mail translations', () => {
	describe('coverage', () => {
		it('offers the same seven variants the catalogue promises', () => {
			expect([...EMAIL_LOCALES]).toEqual([
				'de-sie',
				'de-du',
				'en',
				'fr',
				'ru',
				'ti',
				'tr'
			]);
		});

		it.each([...EMAIL_LOCALES])('%s has all 22 occasions', (locale) => {
			expect(Object.keys(EMAIL_CONTENT[locale]).sort()).toEqual(
				[...EMAIL_IDS].sort()
			);
		});

		it.each([...EMAIL_LOCALES])(
			'%s declares a language tag and a writing direction',
			(locale) => {
				expect(EMAIL_LOCALE_LANG[locale]).toMatch(/^[a-z]{2}$/);
				// Answered rather than assumed: no language the platform
				// offers is RTL. Tigrinya is Ge'ez script, which is LTR.
				expect(EMAIL_LOCALE_DIR[locale]).toBe('ltr');
			}
		);
	});

	describe('parity with the German source', () => {
		it.each(cases)('$locale/$id has the same shape', ({ locale, id }) => {
			expect(shapeOf(EMAIL_CONTENT[locale][id])).toEqual(
				shapeOf(source[id])
			);
		});

		it.each(cases)(
			'$locale/$id interpolates the same placeholders',
			({ locale, id }) => {
				// A dropped placeholder is a mail with a dead button. An added
				// one is worse: `{{consultantName}}` in a mail to an advice
				// seeker breaks the anonymity rule in ADR-019.
				expect(placeholdersOf(EMAIL_CONTENT[locale][id])).toEqual(
					placeholdersOf(source[id])
				);
			}
		);

		it.each(
			EMAIL_TRANSLATED_LOCALES.filter((locale) => locale !== 'de-du')
		)('%s does not simply repeat the German assurance', (locale) => {
			// Catches the whole class of "copied the file, forgot to translate
			// it" — on the one string where that would matter most.
			expect(EMAIL_CONTENT[locale]['neue-nachricht'].assurance).not.toBe(
				source['neue-nachricht'].assurance
			);
		});
	});

	describe('the manifest', () => {
		it('covers every translated locale', () => {
			expect(Object.keys(typedManifest.locales).sort()).toEqual(
				[...EMAIL_TRANSLATED_LOCALES].sort()
			);
			expect(typedManifest.source).toBe(EMAIL_SOURCE_LOCALE);
		});

		it.each(cases)(
			'$locale/$id was translated from the German that is there now',
			({ locale, id }) => {
				const record = typedManifest.locales[locale]?.occasions[id];
				expect(
					record,
					`${locale}/${id} is missing from the manifest — run npm run emails:sync`
				).toBeDefined();
				expect(
					record.source,
					`the German copy for ${id} changed after ${locale} was translated. ` +
						'Re-translate it, then run npm run emails:sync.'
				).toBe(emailOccasionFingerprint(source[id]));
			}
		);

		it.each(cases)(
			'$locale/$id has not been edited without re-stamping',
			({ locale, id }) => {
				expect(
					typedManifest.locales[locale]?.occasions[id]?.target,
					`${locale}/${id} changed since it was stamped — run npm run emails:sync`
				).toBe(emailOccasionFingerprint(EMAIL_CONTENT[locale][id]));
			}
		);

		it.each([...EMAIL_TRANSLATED_LOCALES])(
			'%s records the provenance and release status the catalogue declares',
			(locale) => {
				expect(typedManifest.locales[locale].provenance).toBe(
					EMAIL_LOCALE_PROVENANCE[locale]
				);
				expect(typedManifest.locales[locale].release).toBe(
					EMAIL_LOCALE_RELEASE[locale]
				);
			}
		);
	});

	describe('human review of what the platform claims', () => {
		it('protects the encryption promise, the privacy wording and the DPA mail', () => {
			const paths = [
				...emailProtectedStringIndex(source, EMAIL_IDS).values()
			].map((entry) => entry.path);

			expect(paths).toContain('assurance');
			expect(
				[...emailProtectedStringIndex(source, EMAIL_IDS).values()].map(
					(entry) => entry.value
				)
			).toContain(source['neue-nachricht'].paragraphs[1]);
			expect(
				emailProtectedStringIndex(
					{
						'avv-unterschrift': source['avv-unterschrift']
					} as Record<EmailId, EmailContent>,
					['avv-unterschrift']
				).size
			).toBeGreaterThan(5);
		});

		it('collapses the shared assurance to one signature per language', () => {
			// The promise closes all 22 mails. Asking for 22 signatures per
			// language would guarantee nobody ever finishes.
			const distinct = emailProtectedStringIndex(
				EMAIL_CONTENT.fr,
				EMAIL_IDS
			);
			expect(distinct.size).toBeLessThan(EMAIL_IDS.length);
		});

		it('reports an unsigned protected string, and stops reporting it once signed', () => {
			// The rule itself, exercised — otherwise it would only ever run
			// against locales that are not released yet, and pass vacuously.
			const before = emailReviewGaps(EMAIL_CONTENT.fr, EMAIL_IDS, {});
			expect(before.unsigned.length).toBeGreaterThan(0);
			expect(before.orphaned).toEqual([]);

			const signed = Object.fromEntries(
				[...emailProtectedStringIndex(EMAIL_CONTENT.fr, EMAIL_IDS)].map(
					([fingerprint, entry]) => [
						fingerprint,
						{
							text: entry.value,
							reviewer: 'test',
							reviewedAt: '2026-08-13'
						}
					]
				)
			);
			expect(
				emailReviewGaps(EMAIL_CONTENT.fr, EMAIL_IDS, signed).unsigned
			).toEqual([]);
		});

		it('voids a signature when the sentence it was given for is edited', () => {
			const stale = {
				[emailFingerprint('une phrase qui n’existe plus')]: {
					text: 'une phrase qui n’existe plus',
					reviewer: 'test',
					reviewedAt: '2026-08-13'
				}
			};
			expect(
				emailReviewGaps(EMAIL_CONTENT.fr, EMAIL_IDS, stale).orphaned
			).toHaveLength(1);
		});

		it.each([...EMAIL_TRANSLATED_LOCALES])(
			'%s is only marked released if a person has read what it claims',
			(locale) => {
				if (
					EMAIL_LOCALE_PROVENANCE[locale] !== 'machine' ||
					EMAIL_LOCALE_RELEASE[locale] !== 'released'
				)
					return;

				const gaps = emailReviewGaps(
					EMAIL_CONTENT[locale],
					EMAIL_IDS,
					typedReview.locales[locale] ?? {}
				);
				expect(
					gaps.unsigned.map((entry) => entry.value),
					`${locale} is marked released but these strings have no signature in translationReview.json`
				).toEqual([]);
				expect(
					gaps.orphaned.map((signature) => signature.text),
					`${locale} has signatures for wording that has since been edited`
				).toEqual([]);
			}
		);

		it('keeps a ledger entry for every machine-translated locale', () => {
			EMAIL_TRANSLATED_LOCALES.filter(
				(locale) => EMAIL_LOCALE_PROVENANCE[locale] === 'machine'
			).forEach((locale) => {
				expect(typedReview.locales[locale]).toBeDefined();
			});
		});
	});

	describe('what a service may send', () => {
		it('excludes everything still waiting for a human', () => {
			expect([...EMAIL_RELEASED_LOCALES]).toEqual([
				'de-sie',
				'de-du',
				'en'
			]);
			EMAIL_LOCALES.forEach((locale) => {
				expect(
					EMAIL_RELEASED_LOCALES.includes(locale),
					`${locale} disagrees with EMAIL_LOCALE_RELEASE`
				).toBe(EMAIL_LOCALE_RELEASE[locale] === 'released');
			});
		});
	});
});
