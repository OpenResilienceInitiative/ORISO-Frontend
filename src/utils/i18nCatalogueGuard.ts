import { flatten } from 'flat';

export type CatalogueDrift = {
	extraInLocale: string[];
	missingInLocale: string[];
};

const flattenCatalogue = (catalogue: object): Record<string, unknown> =>
	flatten(catalogue) as Record<string, unknown>;

export const flattenCatalogueKeys = (catalogue: object): string[] =>
	Object.keys(flattenCatalogue(catalogue)).sort((a, b) => a.localeCompare(b));

/**
 * i18next plural suffixes (CLDR categories). Languages need different subsets
 * of these: German uses `one`/`other`, Russian additionally `few`/`many`.
 */
const PLURAL_SUFFIX = /^(.*)_(zero|one|two|few|many|other)$/;

const pluralBase = (key: string): string | undefined =>
	PLURAL_SUFFIX.exec(key)?.[1];

export const collectCatalogueDrift = (
	fallbackKeys: string[],
	localeKeys: string[]
): CatalogueDrift => {
	const fallback = new Set(fallbackKeys);
	const locale = new Set(localeKeys);

	// A locale that carries the plural forms its language requires is correct,
	// not drift. Only bases the fallback itself pluralizes are exempt, so a key
	// the fallback has never heard of still counts even when it ends in a
	// plural suffix.
	const fallbackPluralBases = new Set(
		fallbackKeys.map(pluralBase).filter((base) => base !== undefined)
	);

	const isKnownPluralForm = (key: string): boolean => {
		const base = pluralBase(key);
		return base !== undefined && fallbackPluralBases.has(base);
	};

	return {
		extraInLocale: localeKeys
			.filter((key) => !fallback.has(key) && !isKnownPluralForm(key))
			.sort((a, b) => a.localeCompare(b)),
		missingInLocale: fallbackKeys
			.filter((key) => !locale.has(key))
			.sort((a, b) => a.localeCompare(b))
	};
};

export const collectRedundantOverlayKeys = (
	fallbackCatalogue: object,
	overlayCatalogue: object
): string[] => {
	const fallback = flattenCatalogue(fallbackCatalogue);
	const overlay = flattenCatalogue(overlayCatalogue);

	return Object.keys(overlay)
		.filter((key) => fallback[key] === overlay[key])
		.sort((a, b) => a.localeCompare(b));
};

/**
 * Ratchet helper: the guards tolerate a checked-in list of known offenders, so
 * a failure can name exactly the keys a change introduced instead of reporting
 * that one count grew past another.
 */
export const collectKeysAbsentFromBaseline = (
	baselineKeys: string[],
	currentKeys: string[]
): string[] => {
	const baseline = new Set(baselineKeys);

	return currentKeys
		.filter((key) => !baseline.has(key))
		.sort((a, b) => a.localeCompare(b));
};

export const extractStaticTranslationKeys = (source: string): string[] => {
	const keys = new Set<string>();
	const callPattern =
		/\b(?:translate|t|i18n\.t)\s*\(\s*(['"])([^'"\n]+)\1\s*(?=[,)])/g;
	const componentPattern = /\bi18nKey\s*=\s*(['"])([^'"\n]+)\1/g;

	for (const match of source.matchAll(callPattern)) {
		keys.add(match[2]);
	}
	for (const match of source.matchAll(componentPattern)) {
		keys.add(match[2]);
	}

	return [...keys].sort((a, b) => a.localeCompare(b));
};

export const findUnknownStaticTranslationKeys = (
	sourceFiles: Record<string, string>,
	canonicalKeys: string[]
): string[] => {
	const canonical = new Set(canonicalKeys);
	const usedKeys = new Set(
		Object.values(sourceFiles).flatMap(extractStaticTranslationKeys)
	);

	return [...usedKeys]
		.filter((key) => !canonical.has(key))
		.sort((a, b) => a.localeCompare(b));
};
