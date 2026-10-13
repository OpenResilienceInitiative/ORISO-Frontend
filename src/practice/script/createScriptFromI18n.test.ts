import { describe, expect, it } from 'vitest';
import { createScriptFromI18n } from './createScriptFromI18n';
import {
	createPracticeTestI18n,
	createTestScript,
	PRACTICE_SCRIPT_LOCALES
} from './scriptTestSupport';

describe('createScriptFromI18n', () => {
	it.each(PRACTICE_SCRIPT_LOCALES)(
		'builds the engine in the language the page is in (%s)',
		(locale) => {
			const script = createScriptFromI18n(createPracticeTestI18n(locale));

			expect(script.locale).toBe(locale);
			expect(script.texts).toEqual(createTestScript(locale).texts);
			expect(script.cast.asker.displayName).toBe(
				createTestScript(locale).cast.asker.displayName
			);
		}
	);

	it('keeps the language of the moment it was built when the page switches later', async () => {
		const i18n = createPracticeTestI18n('ru');
		const script = createScriptFromI18n(i18n);
		const before = script.reactionFor({ type: 'supervisor-added' });

		await i18n.changeLanguage('tr');

		expect(script.locale).toBe('ru');
		expect(script.reactionFor({ type: 'supervisor-added' })).toEqual(
			before
		);
	});

	it('falls back to German for a language without a script, like the rest of the app', () => {
		const i18n = createPracticeTestI18n('de');
		void i18n.changeLanguage('es');

		const script = createScriptFromI18n(i18n);

		// i18next reports the bundle it actually reads from.
		expect(script.locale).toBe('de');
		expect(script.texts).toEqual(createTestScript('de').texts);
	});

	it('refuses to start without an i18n instance instead of showing keys', () => {
		expect(() => createScriptFromI18n(undefined)).toThrow(/i18n/);
		expect(() => createScriptFromI18n({} as any)).toThrow(/i18n/);
	});
});
