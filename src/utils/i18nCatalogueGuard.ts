import { flatten } from 'flat';

export type CatalogueDrift = {
	extraInLocale: string[];
	missingInLocale: string[];
};

const flattenCatalogue = (catalogue: object): Record<string, unknown> =>
	flatten(catalogue) as Record<string, unknown>;

export const flattenCatalogueKeys = (catalogue: object): string[] =>
	Object.keys(flattenCatalogue(catalogue)).sort((a, b) => a.localeCompare(b));

export const collectCatalogueDrift = (
	fallbackKeys: string[],
	localeKeys: string[]
): CatalogueDrift => {
	const fallback = new Set(fallbackKeys);
	const locale = new Set(localeKeys);

	return {
		extraInLocale: localeKeys
			.filter((key) => !fallback.has(key))
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
