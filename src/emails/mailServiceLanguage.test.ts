import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mailservice = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'dist/mailservice'
);

const template = (name: string): string =>
	readFileSync(path.join(mailservice, `${name}.ru.html`), 'utf8');

describe('Russian MailService handover copy', () => {
	it('asks the advice seeker neutrally and confirms ownership to the incoming counsellor', () => {
		expect(template('reassign-request-notification')).toContain(
			'запрашивает ваше согласие'
		);
		expect(template('reassign-request-notification')).not.toContain(
			'можете ли Вы принять'
		);
		expect(template('reassign-confirmation-notification')).toContain(
			'Теперь вы отвечаете за эту консультацию'
		);
		expect(template('reassign-confirmation-notification')).not.toContain(
			'Ваш доступ к предыдущей истории'
		);
		expect(template('assign-enquiry-notification')).toContain(
			'Человек, обратившийся за консультацией'
		);
	});
});
