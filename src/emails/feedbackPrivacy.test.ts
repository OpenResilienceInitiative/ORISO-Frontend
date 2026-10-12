import { describe, expect, it } from 'vitest';
import {
	EMAIL_AUDIENCE,
	EMAIL_CLASS,
	EMAIL_CONTENT,
	EMAIL_LOCALES,
	buildEmail,
	listEmailPlaceholders
} from './index';
import {
	CONSULTANT_SWITCHES,
	switchForOccasion
} from '../components/profile/EmailNotifications/notificationMatrix';

describe('protected feedback notification', () => {
	it('keeps the existing consultant preference and optional mail occasion', () => {
		expect(EMAIL_AUDIENCE.rueckmeldung).toBe('consultant');
		expect(EMAIL_CLASS.rueckmeldung).toBe('operational');
		expect(switchForOccasion(CONSULTANT_SWITCHES, 'rueckmeldung')?.id).toBe(
			'feedback'
		);
	});

	it.each(EMAIL_LOCALES)(
		'%s keeps subject and preview neutral and removes private case facts',
		(locale) => {
			const copy = EMAIL_CONTENT[locale].rueckmeldung;
			const mail = buildEmail('rueckmeldung', locale);
			expect(mail.subject).toBe(EMAIL_CONTENT[locale].mitteilung.subject);
			expect(mail.subject).toContain('{{platformName}}');
			expect(mail.preheader).toBe(
				EMAIL_CONTENT[locale].mitteilung.preheader
			);
			expect(copy.panel).toBeUndefined();
			expect(mail.html + mail.text).not.toMatch(
				/{{(?:caseReference|requestReceivedAt|asker\w*|consultant\w*|topic\w*)}}/
			);
			expect(copy.cta.href).toBe('{{messageUrl}}');
			expect(mail.html).toContain('href="{{messageUrl}}"');
			expect(mail.text).toContain('{{messageUrl}}');
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
