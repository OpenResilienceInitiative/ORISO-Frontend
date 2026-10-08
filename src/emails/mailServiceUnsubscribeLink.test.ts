/* eslint-disable no-template-curly-in-string --
 * The MailService templates contain `${...}` as literal Thymeleaf text.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mailservice = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'dist/mailservice'
);

const SUFFIXES = ['', '.en', '.fr', '.ru', '.ti', '.tr'];
const read = (name: string, suffix: string) =>
	readFileSync(path.join(mailservice, `${name}${suffix}.html`), 'utf8');

/**
 * The two handover mails still go through the upstream MailService. Their
 * unsubscribe link used to point at `${url}` — the app's start page — so it
 * named neither the settings screen nor the mail it came from (#872).
 */
describe('MailService unsubscribe link', () => {
	it.each(
		[
			'reassign-request-notification',
			'reassign-confirmation-notification'
		].flatMap((name) => SUFFIXES.map((suffix) => [name, suffix]))
	)(
		'%s%s links unsubscribe to the occasion URL UserService sends',
		(name, suffix) => {
			const html = read(name, suffix);
			expect(
				html.match(/th:href="\|\$\{unsubscribe_url\}\|"/g)
			).toHaveLength(1);
		}
	);

	it('names the occasion link in the English copy', () => {
		expect(read('reassign-confirmation-notification', '.en')).toMatch(
			/href="\{\{unsubscribe_url\}\}"[^>]*th:href="\|\$\{unsubscribe_url\}\|">Unsubscribe from notifications</
		);
	});

	it.each([
		'enquiry-notification-consultant',
		'direct-enquiry-notification-consultant',
		'assign-enquiry-notification',
		'daily-enquiry-notification',
		'free-text'
	])('%s does not expect a value its supplier never sends', (name) => {
		expect(read(name, '')).not.toContain('unsubscribe_url');
	});
});
