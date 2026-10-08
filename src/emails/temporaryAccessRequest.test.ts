import { describe, expect, it } from 'vitest';
import {
	EMAIL_CONTENT,
	EMAIL_LOCALES,
	buildEmail,
	listEmailPlaceholders
} from './index';

describe('temporary access request notification (#1658/#1660)', () => {
	it.each(EMAIL_LOCALES)(
		'%s delivers a temporary access request with a protected decision link',
		(locale) => {
			const content = EMAIL_CONTENT[locale]['einsicht-angefragt'];
			const mail = buildEmail('einsicht-angefragt', locale);
			expect(content).toBeDefined();
			expect(mail.subject).toBe(
				EMAIL_CONTENT[locale]['uebergabe-angefragt'].subject
			);
			expect(mail.preheader).toBe(
				EMAIL_CONTENT[locale]['uebergabe-angefragt'].preheader
			);
			expect(content.paragraphs.join(' ')).not.toBe(
				EMAIL_CONTENT[locale]['uebergabe-angefragt'].paragraphs.join(
					' '
				)
			);
			expect(mail.html).toContain('href="{{requestUrl}}"');
			expect(mail.text).toContain('{{requestUrl}}');
			expect(
				listEmailPlaceholders(JSON.stringify(content)).join(' ')
			).not.toMatch(
				/{{(?:reason|explanation|consultantName|askerName)}}/
			);
		}
	);
});
