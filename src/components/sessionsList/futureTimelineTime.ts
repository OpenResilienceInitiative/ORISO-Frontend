export const toSeriesApiTimestamp = (date: Date): string => date.toISOString();

export const normalizeTimelineLocale = (
	resolvedLanguage?: string,
	language?: string
): string => {
	const candidate = (resolvedLanguage || language || 'en')
		.split('@')[0]
		.replace(/_/g, '-');
	try {
		return Intl.DateTimeFormat.supportedLocalesOf(candidate)[0] || 'en';
	} catch {
		return 'en';
	}
};
