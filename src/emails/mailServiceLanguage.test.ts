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
	it('uses formal address and the consultation term in generated mail', () => {
		expect(template('reassign-request-notification')).toContain(
			'можете ли Вы принять её'
		);
		expect(template('reassign-confirmation-notification')).toContain(
			'Теперь Вы отвечаете за эту консультацию'
		);
		expect(template('reassign-confirmation-notification')).toContain(
			'Человек, обратившийся за консультацией'
		);
		expect(template('assign-enquiry-notification')).toContain(
			'Человек, обратившийся за консультацией'
		);
	});
});
