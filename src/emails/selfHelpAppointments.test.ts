import { describe, expect, it } from 'vitest';
import {
	EMAIL_AUDIENCE,
	EMAIL_CLASS,
	EMAIL_CONTENT,
	EMAIL_LOCALES,
	buildEmail
} from './index';

const occasions = [
	'bestaetigt',
	'verschoben',
	'abgesagt',
	'erinnerung'
] as const;
const roles = ['teilnahme', 'beratung'] as const;

describe('self-help appointment mail', () => {
	it.each(EMAIL_LOCALES)(
		'%s keeps inbox metadata neutral for every event and role',
		(locale) => {
			for (const occasion of occasions) {
				for (const role of roles) {
					const id =
						`selbsthilfe-termin-${occasion}-${role}` as const;
					const content = EMAIL_CONTENT[locale][id];
					expect(
						`${content.subject} ${content.preheader}`
					).not.toMatch(
						/\{\{(?:group|topic|participant|counselor|consultant|location)/i
					);
					expect(content.subject).not.toContain(
						'{{appointmentDate}}'
					);
					expect(content.panel).toHaveLength(2);
					expect(content.cta?.href).toBe('{{appointmentUrl}}');
					expect(EMAIL_AUDIENCE[id]).toBe(
						role === 'teilnahme' ? 'asker' : 'consultant'
					);
					expect(EMAIL_CLASS[id]).toBe(
						role === 'teilnahme' ? 'personal' : 'operational'
					);
					expect(buildEmail(id, locale).text).toContain(
						'{{appointmentUrl}}'
					);
				}
			}
		}
	);
});
