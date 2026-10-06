/** Deliberate exceptions must name the exact locale and occasion they affect. */
export const parseTranslationSyncOptions = (
	args: string[],
	locales: readonly string[],
	occasions: readonly string[]
) => {
	const knownLocales = new Set(locales);
	const knownOccasions = new Set(occasions);
	const forcedPairs = new Set<string>();
	const newLocales = new Set<string>();
	let check = false;
	for (const arg of args) {
		if (arg === '--check') {
			check = true;
		} else if (arg.startsWith('--force=')) {
			const pair = arg.slice('--force='.length);
			const [locale, occasion, extra] = pair.split('/');
			if (
				extra ||
				!knownLocales.has(locale) ||
				!knownOccasions.has(occasion)
			) {
				throw new Error(
					`Invalid --force pair: ${pair}. Use --force=locale/occasion.`
				);
			}
			forcedPairs.add(pair);
		} else if (arg.startsWith('--new-locale=')) {
			const locale = arg.slice('--new-locale='.length);
			if (!knownLocales.has(locale)) {
				throw new Error(`Invalid --new-locale: ${locale}.`);
			}
			newLocales.add(locale);
		} else {
			throw new Error(`Unknown emails:sync argument: ${arg}.`);
		}
	}
	if (check && (forcedPairs.size > 0 || newLocales.size > 0)) {
		throw new Error(
			'--check cannot be combined with translation exceptions.'
		);
	}
	return { check, forcedPairs, newLocales };
};

export const requireTranslationLocaleBaseline = (
	locale: string,
	hasBaseline: boolean,
	approvedNewLocales: ReadonlySet<string>
): boolean => {
	if (hasBaseline) return false;
	if (approvedNewLocales.has(locale)) return true;
	throw new Error(
		`Translation manifest lost locale ${locale}; restore it, or initialize a genuinely new language with --new-locale=${locale}.`
	);
};
