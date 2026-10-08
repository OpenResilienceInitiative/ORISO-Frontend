import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMAIL_LOCALES } from '../content/emailCatalogue';

const appCatalogue = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../resources/i18n'
);

/** The App's bundled common catalogues are the source of required mail languages. */
export const bundledAppLocales = (): string[] =>
	readdirSync(appCatalogue, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((locale) => {
			try {
				return readdirSync(path.join(appCatalogue, locale)).includes(
					'common.json'
				);
			} catch {
				return false;
			}
		})
		.sort();

export const missingMailLocales = (appLocales: readonly string[]): string[] =>
	appLocales.filter(
		(locale) =>
			!EMAIL_LOCALES.includes(
				(locale === 'de'
					? 'de-sie'
					: locale === 'de@informal'
						? 'de-du'
						: locale) as (typeof EMAIL_LOCALES)[number]
			)
	);

export const assertAppLocaleCoverage = (): void => {
	const missing = missingMailLocales(bundledAppLocales());
	if (missing.length > 0) {
		throw new Error(
			`Missing e-mail copy for App locale(s): ${missing.join(', ')}`
		);
	}
};
