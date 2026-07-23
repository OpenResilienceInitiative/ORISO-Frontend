/**
 * UserService accepts neovisionaries LanguageCode values (e.g. "de", "en"),
 * not BCP-47 locale tags such as "en-IN" or "en-GB".
 */
export const normalizePreferredLanguage = (
	locale?: string,
	fallback = 'de'
): string => {
	if (!locale) {
		return fallback;
	}

	const normalized = locale.toLowerCase().split(/[-_@.]/)[0];
	return normalized || fallback;
};
