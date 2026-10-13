import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mailservice = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'dist/mailservice'
);

const template = (name: string, locale = 'ru'): string =>
	readFileSync(path.join(mailservice, `${name}.${locale}.html`), 'utf8');

describe('Russian MailService handover copy', () => {
	it('asks the advice seeker neutrally and confirms ownership to the incoming counsellor', () => {
		expect(template('reassign-request-notification')).toContain(
			'запрашивает Ваше согласие'
		);
		expect(template('reassign-request-notification')).not.toContain(
			'можете ли Вы принять'
		);
		expect(template('reassign-confirmation-notification')).toContain(
			'Теперь Вы отвечаете за эту консультацию'
		);
		expect(template('reassign-confirmation-notification')).not.toContain(
			'Ваш доступ к предыдущей истории'
		);
		expect(template('assign-enquiry-notification')).toContain(
			'Человек, обратившийся за консультацией'
		);
	});
});

describe('MailService locale terminology', () => {
	it.each([
		['ti', 'enquiry-notification-consultant', 'ፖስጣ ኮድ', 'ፖስታ ኮድ'],
		['ti', 'assign-enquiry-notification', 'ምኽሪ ዝሓትት ሰብ', 'ምኽሪ ዝደልይ ሰብ'],
		[
			'tr',
			'assign-enquiry-notification',
			'danışan',
			'Danışmanlık isteyen kişi'
		]
	])(
		'%s uses the canonical terminology in %s',
		(locale, name, expected, stale) => {
			expect(template(name, locale)).toContain(expected);
			expect(template(name, locale)).not.toContain(stale);
		}
	);
});
