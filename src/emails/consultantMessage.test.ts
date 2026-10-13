import { describe, expect, it } from 'vitest';
import {
	EMAIL_AUDIENCE,
	EMAIL_CLASS,
	EMAIL_CONTENT,
	EMAIL_LOCALES,
	buildEmail,
	listEmailPlaceholders
} from './index';

const occasion = 'neue-nachricht-beratung';

describe('new message to the consultant', () => {
	it('declares an operational mail addressed to the consultant', () => {
		expect(EMAIL_AUDIENCE[occasion]).toBe('consultant');
		expect(EMAIL_CLASS[occasion]).toBe('operational');
	});

	it.each(EMAIL_LOCALES)(
		'%s keeps the mailbox subject and preview neutral with a configured product name',
		(locale) => {
			const mail = buildEmail(occasion, locale);
			const neutral = EMAIL_CONTENT[locale].mitteilung;
			expect(mail.subject).toBe(neutral.subject);
			expect(mail.subject).toContain('{{platformName}}');
			expect(mail.preheader).toBe(neutral.preheader);
			expect(mail.preheader).not.toContain('{{');
			expect(mail.subject).not.toMatch(
				/ORISO|{{(?:asker|consultant|topic|case|message)(?!Url)\w*}}/
			);
		}
	);

	it.each(EMAIL_LOCALES)(
		'%s uses consultant copy and the existing message destination in both MIME parts',
		(locale) => {
			const copy = EMAIL_CONTENT[locale][occasion];
			const seeker = EMAIL_CONTENT[locale]['neue-nachricht'];
			const mail = buildEmail(occasion, locale);
			expect(copy.paragraphs).not.toEqual(seeker.paragraphs);
			expect(copy.footnote).toBeUndefined();
			expect(copy.assurance).toBe(
				EMAIL_CONTENT[locale]['uebergabe-bestaetigt'].assurance
			);
			expect(copy.cta.href).toBe('{{messageUrl}}');
			expect(mail.html).toContain('href="{{messageUrl}}"');
			expect(mail.text).toContain('{{messageUrl}}');
			expect(copy.footer.links).toEqual(seeker.footer.links);
			expect(listEmailPlaceholders(JSON.stringify(copy)).sort()).toEqual([
				'{{imprintUrl}}',
				'{{messageUrl}}',
				'{{orgName}}',
				'{{platformName}}',
				'{{privacyUrl}}',
				'{{settingsUrl}}',
				'{{unsubscribeUrl}}'
			]);
		}
	);
});
