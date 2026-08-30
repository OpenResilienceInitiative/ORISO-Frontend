export type SupportedLanguagesInput = {
	/**
	 * Languages Weblate reported as translated above `weblate.percentage`.
	 * Empty either because nothing cleared the bar or because we never got an
	 * answer — `weblateCoverageAvailable` is what tells those two apart.
	 */
	weblateLanguages: readonly string[];
	/**
	 * Whether the Weblate languages request actually completed.
	 *
	 * A request that succeeds and qualifies nothing is still coverage data: it
	 * says "no language clears the threshold", and the gate has to stay on.
	 * Only an absent or failed request leaves us unable to judge, and only
	 * then may every requested language through. Deriving this from
	 * `weblateLanguages.length` conflates the two and silently disables the
	 * gate for exactly the tenant it should protect (ORISO-Frontend#1154).
	 */
	weblateCoverageAvailable: boolean;
	/** Languages that ship a complete catalogue in the bundle. */
	bundledLanguages: readonly string[];
	/** Languages the app config and the tenant between them ask for. */
	supportedLngs: readonly string[] | false | undefined;
	fallbackLng: string;
};

/**
 * Resolve the languages the picker may offer.
 *
 * The tenant's `activeLanguages` used to be unioned with the Weblate result
 * unfiltered, so the `weblate.percentage` threshold could only ever *add* a
 * language, never withhold one — a tenant activating a barely-translated,
 * Weblate-only language shipped it to advice seekers as a mostly German UI.
 */
export const collectSupportedLanguages = ({
	weblateLanguages,
	weblateCoverageAvailable,
	bundledLanguages,
	supportedLngs,
	fallbackLng
}: SupportedLanguagesInput): string[] => {
	if (!supportedLngs || supportedLngs.length === 0) {
		return [fallbackLng, `${fallbackLng}@informal`];
	}

	const bundled = new Set(bundledLanguages);
	const qualifying = new Set(weblateLanguages);

	const meetsCoverageThreshold = (lng: string) =>
		// A bundled catalogue is complete regardless of what Weblate holds, so
		// its language must never be withheld.
		bundled.has(lng) ||
		!weblateCoverageAvailable ||
		lng === fallbackLng ||
		lng.indexOf('@informal') !== -1 ||
		qualifying.has(lng);

	return [
		...new Set(
			[...weblateLanguages, ...supportedLngs].filter(
				meetsCoverageThreshold
			)
		)
	];
};
