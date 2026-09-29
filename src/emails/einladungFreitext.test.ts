import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMAIL_IDS, EMAIL_LOCALES, buildEmail } from './index';

/**
 * `einladung-freitext` is the ORISO frame around an invite the operator wrote
 * themselves. UserService renders it (`InviteFrameMailRenderer`), but its
 * template files are synced from this kit by `scripts/sync-email-templates.sh`,
 * which deletes the target directory first. So the kit has to emit exactly the
 * files UserService ships, or the next sync silently changes — or removes — the
 * invite mail.
 *
 * The fixtures are the UserService files verbatim, from
 * `feat/mail-footer-org-from-tenant` @ 8ca0d787 (the merge-order tip, which
 * contains #1233 and #1238) — the frame whose fine print (`{{assuranceBlock}}`)
 * and footer note (`{{footerNote}}`) UserService fills according to whether
 * the mail has an action.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (locale: string, ext: 'html' | 'txt'): string =>
	readFileSync(
		path.join(
			here,
			'__fixtures__/userservice',
			locale,
			`einladung-freitext.${ext}`
		),
		'utf8'
	);

const dist = (dialect: string, locale: string, file: string): string =>
	path.join(here, 'dist', dialect, locale, file);

describe('einladung-freitext', () => {
	it('is in the catalogue', () => {
		expect(EMAIL_IDS).toContain('einladung-freitext');
	});

	describe.each([...EMAIL_LOCALES])('%s', (locale) => {
		it('renders the html part UserService ships', () => {
			expect(buildEmail('einladung-freitext', locale).html).toBe(
				fixture(locale, 'html')
			);
		});

		it('renders the text part UserService ships', () => {
			expect(buildEmail('einladung-freitext', locale).text).toBe(
				fixture(locale, 'txt')
			);
		});

		// Frank, 2026-09-23: "X ist ein Angebot von Y" names the platform and
		// its operator. A Träger may brand the header and overlay the sender
		// block, so neither `platformName` nor `orgName` may stand here.
		it('names the platform and its operator in the offered-by line', () => {
			const offeredBy =
				locale === 'en'
					? '{{offeringName}} is a service provided by {{operatorName}}.'
					: '{{offeringName}} ist ein Angebot von {{operatorName}}.';
			const { html, text } = buildEmail('einladung-freitext', locale);
			for (const part of [html, text]) {
				expect(part).toContain(offeredBy);
				expect(part).not.toMatch(
					/\{\{(platformName|orgName)\}\} (ist ein Angebot|is a service)|(ist ein Angebot von|is a service provided by) \{\{orgName\}\}/
				);
			}
		});

		it('is in the committed plain build output', () => {
			const built = buildEmail('einladung-freitext', locale);
			expect(
				readFileSync(
					dist('plain', locale, 'einladung-freitext.html'),
					'utf8'
				)
			).toBe(built.html);
			expect(
				readFileSync(
					dist('plain', locale, 'einladung-freitext.txt'),
					'utf8'
				)
			).toBe(built.text);
		});

		it('ships in no engine dialect, whose escaping would print the authored HTML as text', () => {
			expect(
				existsSync(dist('thymeleaf', locale, 'einladung-freitext.html'))
			).toBe(false);
			expect(
				existsSync(
					dist('freemarker', locale, 'einladung-freitext.html.ftl')
				)
			).toBe(false);
		});
	});
});
