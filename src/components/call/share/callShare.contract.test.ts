import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * What jsdom cannot see about the call's share button: its focus ring on the
 * dark stage, and the warning before "Anklopfen" goes off. Read as text.
 */
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('the share button on the call stage (#1794)', () => {
	it('shows a light focus ring, since the red one is lost on the dark stage', () => {
		const scss = read('src/components/call/GroupCallWidget.scss').replace(
			/\/\*[\s\S]*?\*\//g,
			''
		);
		const share = scss.slice(scss.indexOf('.element-call-share {'));
		expect(share).toMatch(
			/\.callShare__trigger:focus-visible\s+\.callShare__triggerInner\s*\{[^}]*outline:\s*3px solid #fff/
		);
	});
});

describe('the "Anklopfen" switch (#1794, UserService#1488)', () => {
	const locales = ['de', 'de@informal', 'en', 'fr', 'ru', 'ti', 'tr'];
	const knockOn = (locale: string): string =>
		JSON.parse(read(`src/resources/i18n/${locale}/common.json`)).calls.share
			.knock.on;

	it('warns while it is on that switching it off lets everyone waiting in', () => {
		// The server admits every waiting guest the moment it goes off, so the
		// text shown before that (the "on" text) has to say so.
		expect(knockOn('de')).toContain('alle Wartenden sofort');
		expect(knockOn('de@informal')).toContain('alle Wartenden sofort');
		expect(knockOn('en')).toContain('everyone waiting in at once');
		for (const locale of locales)
			expect(
				knockOn(locale)
					.split(/[.።]\s*/)
					.filter(Boolean).length
			).toBe(2);
	});
});
