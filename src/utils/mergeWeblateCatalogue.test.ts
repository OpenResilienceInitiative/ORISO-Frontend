import { describe, expect, it } from 'vitest';
import { mergeWeblateCatalogue } from './mergeWeblateCatalogue';

describe('mergeWeblateCatalogue (#1154)', () => {
	it('keeps the bundled value when Weblate still has an English placeholder', () => {
		const merged = mergeWeblateCatalogue(
			{ registration: { headline: 'Inscription' } },
			{ registration: { headline: 'Registration' } }
		);

		expect(merged).toEqual({
			registration: { headline: 'Inscription' }
		});
	});

	it('fills a key the bundle does not ship from Weblate', () => {
		const merged = mergeWeblateCatalogue(
			{ registration: { headline: 'Inscription' } },
			{
				registration: {
					headline: 'Registration',
					extra: 'Weblate only'
				}
			}
		);

		expect(merged).toEqual({
			registration: { headline: 'Inscription', extra: 'Weblate only' }
		});
	});

	it('returns the bundle unchanged when Weblate is empty', () => {
		const bundle = { registration: { headline: 'Inscription' } };

		expect(mergeWeblateCatalogue(bundle, {})).toEqual(bundle);
	});

	it('returns Weblate intact when the bundle is empty (Weblate-only locale)', () => {
		const weblate = { registration: { headline: 'Реєстрація' } };

		expect(mergeWeblateCatalogue({}, weblate)).toEqual(weblate);
	});
});
