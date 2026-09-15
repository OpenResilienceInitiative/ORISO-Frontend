import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	EMAIL_DIALECTS,
	EMAIL_DIALECT_INFO,
	EMAIL_IDS,
	EMAIL_LOCALES,
	EMAIL_SAMPLE_VALUES,
	EmailId,
	EmailLocale,
	buildEmail,
	emailSampleBrand,
	fillEmailPlaceholders
} from './index';

const CALL_IDS = [
	'anruf-erinnerung',
	'anruf-einladung',
	'anruf-verpasst'
] as const satisfies readonly EmailId[];

const EXPECTED_SUBJECTS: Record<
	(typeof CALL_IDS)[number],
	Record<EmailLocale, string>
> = {
	'anruf-erinnerung': {
		'de-sie': 'Eine Sitzung beginnt bald',
		'de-du': 'Eine Sitzung beginnt bald',
		'en': 'A session is starting soon'
	},
	'anruf-einladung': {
		'de-sie': 'Sie wurden zu einer Sitzung eingeladen',
		'de-du': 'Du wurdest zu einer Sitzung eingeladen',
		'en': 'You have been invited to a session'
	},
	'anruf-verpasst': {
		'de-sie': 'Sie haben einen Anruf verpasst',
		'de-du': 'Du hast einen Anruf verpasst',
		'en': 'You missed a call'
	}
};

const values = {
	...EMAIL_SAMPLE_VALUES,
	platformName: emailSampleBrand.platformName,
	orgName: emailSampleBrand.orgName,
	orgAddress: emailSampleBrand.orgAddress,
	contactLine: emailSampleBrand.contactLine,
	callUrl:
		'https://beratung.example.org/gespraeche/anruf?room=alpha&via=matrix'
};

describe('call e-mail templates', () => {
	it('publishes the selected call occasions in the catalogue', () => {
		expect(EMAIL_IDS).toEqual(expect.arrayContaining(CALL_IDS));
	});

	it.each(
		CALL_IDS.flatMap((id) =>
			EMAIL_LOCALES.map((locale) => ({ id, locale }))
		)
	)(
		'$id/$locale renders complete privacy-neutral content',
		({ id, locale }) => {
			const built = buildEmail(id, locale, { brand: emailSampleBrand });
			const rendered = {
				subject: fillEmailPlaceholders(built.subject, values),
				preheader: fillEmailPlaceholders(built.preheader, values),
				html: fillEmailPlaceholders(built.html, values),
				text: fillEmailPlaceholders(built.text, values)
			};

			expect(rendered.subject).toBe(EXPECTED_SUBJECTS[id][locale]);
			expect(rendered.html).toContain(values.callUrl);
			expect(rendered.text).toContain(values.callUrl);
			expect(Object.values(rendered).join('\n')).not.toMatch(
				/\{\{[^}]+\}\}/
			);
			expect(`${rendered.subject}\n${rendered.preheader}`).not.toMatch(
				/(participant|teilnehm|topic|thema|frank|gerhardt)/i
			);
		}
	);

	it('keeps every committed call asset and catalogue entry bound to its source', () => {
		const dist = path.resolve(process.cwd(), 'src/emails/dist');
		const catalogue = JSON.parse(
			readFileSync(path.join(dist, 'catalogue.json'), 'utf8')
		) as {
			mails: Record<
				string,
				{
					tones: Record<
						string,
						{ subject: string; preheader: string }
					>;
				}
			>;
		};

		for (const id of CALL_IDS) {
			for (const locale of EMAIL_LOCALES) {
				const source = buildEmail(id, locale);
				expect(catalogue.mails[id].tones[locale]).toMatchObject({
					subject: source.subject,
					preheader: source.preheader
				});

				for (const dialect of EMAIL_DIALECTS) {
					const built = buildEmail(id, locale, { dialect });
					const extensions = EMAIL_DIALECT_INFO[dialect].extension;
					const asset = (part: 'html' | 'text') =>
						path.join(
							dist,
							dialect,
							locale,
							`${id}.${extensions[part]}`
						);

					expect(readFileSync(asset('html'), 'utf8')).toBe(
						built.html
					);
					expect(readFileSync(asset('text'), 'utf8')).toBe(
						built.text
					);
				}
			}
		}
	});
});
