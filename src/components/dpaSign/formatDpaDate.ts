const DPA_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

// TenantService sends the version time as zoneless UTC; read it as UTC and show Berlin time.
export const formatDpaDate = (value: string, language: string) => {
	const date = new Date(
		/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
	);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	const locale = language === 'en' ? 'en-GB' : 'de-DE';
	let formatter = DPA_DATE_FORMATTERS.get(locale);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, {
			dateStyle: 'long',
			timeStyle: 'short',
			timeZone: 'Europe/Berlin'
		});
		DPA_DATE_FORMATTERS.set(locale, formatter);
	}

	return formatter.format(date);
};
