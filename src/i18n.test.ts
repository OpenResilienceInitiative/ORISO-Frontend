import { readFileSync } from 'node:fs';

import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

import de from './resources/i18n/de/common.json';
import deInformal from './resources/i18n/de@informal/common.json';
import en from './resources/i18n/en/common.json';
import fr from './resources/i18n/fr/common.json';
import ru from './resources/i18n/ru/common.json';
import ti from './resources/i18n/ti/common.json';
import tr from './resources/i18n/tr/common.json';
import {
	collectCatalogueDrift,
	collectRedundantOverlayKeys,
	extractStaticTranslationKeys,
	findUnknownStaticTranslationKeys,
	flattenCatalogueKeys
} from './utils/i18nCatalogueGuard';

const driftBudgets = {
	en: { extraInLocale: 5, missingInLocale: 63 },
	fr: { extraInLocale: 5, missingInLocale: 770 },
	// Russian is allowed two keys German cannot have: i18next plural
	// categories. Russian resolves one/few/many/other, German only
	// one/other, so `registration.zipcode.remaining_few` and `_many` have no
	// German counterpart by definition. Everything above 7 is real drift.
	ru: { extraInLocale: 7, missingInLocale: 770 },
	ti: { extraInLocale: 5, missingInLocale: 806 },
	tr: { extraInLocale: 5, missingInLocale: 752 }
} as const;

const locales = { en, fr, ru, ti, tr } as const;
const deKeys = flattenCatalogueKeys(de);

describe('i18n catalogue guard (#1101)', () => {
	it('reports missing and extra keys from hand-checked fixtures', () => {
		expect(
			collectCatalogueDrift(
				['account.name', 'account.email'],
				['account.name', 'account.phone']
			)
		).toEqual({
			extraInLocale: ['account.phone'],
			missingInLocale: ['account.email']
		});
	});

	// German has only `one`/`other`, Russian additionally needs `few`/`many`.
	// A locale carrying the plural forms its language requires is correct, not
	// drift — see #1106.
	it('does not report richer plural forms as extra keys', () => {
		expect(
			collectCatalogueDrift(
				['zipcode.remaining_one', 'zipcode.remaining_other'],
				[
					'zipcode.remaining_one',
					'zipcode.remaining_few',
					'zipcode.remaining_many',
					'zipcode.remaining_other'
				]
			).extraInLocale
		).toEqual([]);
	});

	// The exemption is scoped to plural bases the fallback actually knows, so a
	// genuinely unknown key still counts even when it ends in a plural suffix.
	it('still reports a plural-suffixed key whose base the fallback does not have', () => {
		expect(
			collectCatalogueDrift(
				['zipcode.remaining_one'],
				['zipcode.remaining_one', 'zipcode.unknown_many']
			).extraInLocale
		).toEqual(['zipcode.unknown_many']);
	});

	it.each(Object.entries(locales))(
		'does not allow the $0 catalogue to exceed its existing drift budget',
		(lng, catalogue) => {
			const drift = collectCatalogueDrift(
				deKeys,
				flattenCatalogueKeys(catalogue)
			);
			const budget = driftBudgets[lng as keyof typeof driftBudgets];

			expect(drift.extraInLocale.length).toBeLessThanOrEqual(
				budget.extraInLocale
			);
			expect(drift.missingInLocale.length).toBeLessThanOrEqual(
				budget.missingInLocale
			);
		}
	);

	it('does not allow another redundant value in the sparse informal overlay', () => {
		expect(
			collectRedundantOverlayKeys(de, deInformal).length
		).toBeLessThanOrEqual(596);
	});

	it('extracts literal translation calls and ignores dynamic keys', () => {
		const source = `
			translate('navigation.home');
			t("navigation.settings", { defaultValue: 'Settings' });
			i18n.t('navigation.logout');
			<Component i18nKey="navigation.help" />;
			translate('profile.' + field);
			translate(\`profile.\${field}\`);
		`;

		expect(extractStaticTranslationKeys(source)).toEqual([
			'navigation.help',
			'navigation.home',
			'navigation.logout',
			'navigation.settings'
		]);
	});

	it('reports literal source keys that are absent from the canonical catalogue', () => {
		expect(
			findUnknownStaticTranslationKeys(
				{
					'a.tsx': `translate('known.title')`,
					'b.tsx': `t('missing.title')`
				},
				['known.title']
			)
		).toEqual(['missing.title']);
	});

	it('does not allow another unknown literal translation key in source', () => {
		const sourceFiles = Object.fromEntries(
			globSync('src/**/*.{ts,tsx}', {
				ignore: ['**/*.test.*', '**/*.stories.*', '**/__tests__/**']
			}).map((path) => [path, readFileSync(path, 'utf8')])
		);

		expect(
			findUnknownStaticTranslationKeys(sourceFiles, deKeys).length
		).toBeLessThanOrEqual(58);
	});
});
