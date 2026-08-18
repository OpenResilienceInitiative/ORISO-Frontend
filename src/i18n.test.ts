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
import deConsultingTypes from './resources/i18n/de/consultingTypes.json';
import enConsultingTypes from './resources/i18n/en/consultingTypes.json';
import frConsultingTypes from './resources/i18n/fr/consultingTypes.json';
import ruConsultingTypes from './resources/i18n/ru/consultingTypes.json';
import tiConsultingTypes from './resources/i18n/ti/consultingTypes.json';
import trConsultingTypes from './resources/i18n/tr/consultingTypes.json';
import guardBaseline from './i18nCatalogueGuard.baseline.json';
import {
	collectCatalogueDrift,
	collectKeysAbsentFromBaseline,
	collectRedundantOverlayKeys,
	extractStaticTranslationKeys,
	findUnknownStaticTranslationKeys,
	flattenCatalogueKeys
} from './utils/i18nCatalogueGuard';

const driftBudgets = {
	en: { extraInLocale: 5, missingInLocale: 63 },
	fr: { extraInLocale: 5, missingInLocale: 699 },
	ru: { extraInLocale: 5, missingInLocale: 699 },
	ti: { extraInLocale: 5, missingInLocale: 702 },
	tr: { extraInLocale: 5, missingInLocale: 699 }
} as const;

const locales = { en, fr, ru, ti, tr } as const;
const deKeys = flattenCatalogueKeys(de);

const consultingTypeCatalogues = {
	en: enConsultingTypes,
	fr: frConsultingTypes,
	ru: ruConsultingTypes,
	ti: tiConsultingTypes,
	tr: trConsultingTypes
} as const;

// A failing guard has to name the keys it tripped over; a bare count sends the
// next reader into `git log`. Long lists stay readable by showing the head.
const listKeys = (keys: string[], limit = 20): string =>
	keys.length > limit
		? `${keys.slice(0, limit).join(', ')} … and ${keys.length - limit} more`
		: keys.join(', ');

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

	it('reports only the offending keys the baseline does not already cover', () => {
		expect(
			collectKeysAbsentFromBaseline(
				['attachments.reveal', 'attachments.title'],
				['attachments.mediaCheck.error', 'attachments.reveal']
			)
		).toEqual(['attachments.mediaCheck.error']);
	});

	it.each(Object.entries(locales))(
		'does not allow the $0 catalogue to exceed its existing drift budget',
		(lng, catalogue) => {
			const drift = collectCatalogueDrift(
				deKeys,
				flattenCatalogueKeys(catalogue)
			);
			const budget = driftBudgets[lng as keyof typeof driftBudgets];

			expect(
				drift.extraInLocale.length,
				`${lng}/common.json carries ${drift.extraInLocale.length} keys ` +
					`(budget ${budget.extraInLocale}) that de/common.json does not ` +
					`have. Add them to the German catalogue or drop them here: ` +
					listKeys(drift.extraInLocale)
			).toBeLessThanOrEqual(budget.extraInLocale);
			expect(
				drift.missingInLocale.length,
				`${lng}/common.json is missing ${drift.missingInLocale.length} keys ` +
					`(budget ${budget.missingInLocale}) that de/common.json has. New ` +
					`keys usually land in de first — translate them, or raise this ` +
					`locale's budget deliberately: ` +
					listKeys(drift.missingInLocale)
			).toBeLessThanOrEqual(budget.missingInLocale);
		}
	);

	it('does not allow another redundant value in the sparse informal overlay', () => {
		const newlyRedundant = collectKeysAbsentFromBaseline(
			guardBaseline.redundantInformalOverlayKeys,
			collectRedundantOverlayKeys(de, deInformal)
		);

		expect(
			newlyRedundant,
			'de@informal is a sparse overlay and may only carry values that differ ' +
				'from de/common.json. Delete these keys from ' +
				'src/resources/i18n/de@informal/common.json — the de value is used ' +
				'automatically — or give them a genuinely informal wording: ' +
				listKeys(newlyRedundant)
		).toEqual([]);
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

		const newlyUnknown = collectKeysAbsentFromBaseline(
			guardBaseline.unknownStaticTranslationKeys,
			findUnknownStaticTranslationKeys(sourceFiles, deKeys)
		);

		expect(
			newlyUnknown,
			'These literal translation keys are used in src but absent from ' +
				'de/common.json, so they render as their own key at runtime. Add ' +
				'them to the German catalogue or fix the typo: ' +
				listKeys(newlyUnknown)
		).toEqual([]);
	});
});

describe('consulting-type catalogues are per language (#1154)', () => {
	// Every non-German locale used to be wired to `enConsultingTypes` in
	// `config.ts`, so counselling topics rendered in English no matter which
	// language the person had chosen. These two guards are what would have
	// caught that: the file has to exist and cover the German key set, and it
	// has to say something other than English.
	it.each(Object.entries(consultingTypeCatalogues))(
		'gives the $0 locale a consultingTypes catalogue with the German key set',
		(lng, catalogue) => {
			const drift = collectCatalogueDrift(
				// `consultingType.0` is an empty placeholder in the German
				// source and carries no copy, so a locale that omits it — as
				// `en` always has — is not missing a translation.
				flattenCatalogueKeys(deConsultingTypes).filter(
					(key) => key !== 'consultingType.0'
				),
				flattenCatalogueKeys(catalogue)
			);

			expect(
				drift.missingInLocale,
				`${lng}/consultingTypes.json is missing keys that ` +
					`de/consultingTypes.json has, so those counselling topics fall ` +
					`back to another language: ${listKeys(drift.missingInLocale)}`
			).toEqual([]);
		}
	);

	it.each(
		Object.entries(consultingTypeCatalogues).filter(([lng]) => lng !== 'en')
	)(
		'does not serve the English topic titles as the $0 catalogue',
		(lng, catalogue) => {
			const total = flattenCatalogueKeys(catalogue).length;
			// A locale may legitimately share a word with English
			// ("Prostitution" in French), so require that most of the
			// catalogue differs rather than every single entry.
			const untranslated = collectRedundantOverlayKeys(
				enConsultingTypes,
				catalogue
			);

			expect(
				untranslated.length,
				`${untranslated.length} of ${total} values in ` +
					`${lng}/consultingTypes.json are identical to the English ` +
					`catalogue. Translate them from de/consultingTypes.json: ` +
					listKeys(untranslated)
			).toBeLessThan(total / 10);
		}
	);
});
