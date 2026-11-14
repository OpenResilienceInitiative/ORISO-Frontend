import { describe, expect, it } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

const LANGUAGES = { de, en, fr, ru, ti, tr } as Record<
	string,
	{ calendar: { blocker: Record<string, string> } }
>;

/** The form i18next picks for `count` (key_<category>, else the bare key). */
const pluralForm = (
	messages: Record<string, string>,
	key: string,
	language: string,
	count: number
) =>
	messages[`${key}_${new Intl.PluralRules(language).select(count)}`] ??
	messages[key];

describe('calendar blocker notices', () => {
	it.each(Object.keys(LANGUAGES))(
		'%s names the count of a series of several blocked times',
		(language) => {
			const blocker = LANGUAGES[language].calendar.blocker;
			// 21, 31 and 101 are "one" in Russian.
			[2, 5, 21, 31, 101, 120].forEach((count) =>
				expect(
					pluralForm(blocker, 'created', language, count)
				).toContain('{{count}}')
			);
		}
	);

	it.each(Object.keys(LANGUAGES))(
		'%s names the date of a single blocked time',
		(language) => {
			expect(
				LANGUAGES[language].calendar.blocker.createdSingle
			).toContain('{{date}}');
		}
	);

	it.each(Object.keys(LANGUAGES))(
		'%s explains the occurrence bound',
		(language) => {
			expect(LANGUAGES[language].calendar.blocker.tooMany).toContain(
				'{{max}}'
			);
		}
	);
});
