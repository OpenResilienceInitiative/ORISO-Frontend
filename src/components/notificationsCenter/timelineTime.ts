/**
 * Locale-aware time formatting for the Activity Timeline (#845).
 *
 * The old inline formatter emitted hardcoded English ('5h ago') inside
 * an otherwise German UI. All formatting now goes through Intl with the
 * active i18n language.
 */

/** Naive server timestamps (no zone suffix) are UTC — normalise to `Z`. */
const normalizeServerTimestamp = (createdAt: string): string =>
	createdAt &&
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt) &&
	!/Z|[+-]\d{2}:\d{2}$/.test(createdAt)
		? `${createdAt}Z`
		: createdAt;

const parse = (createdAt: string): Date | null => {
	const date = new Date(normalizeServerTimestamp(createdAt));
	return Number.isNaN(date.getTime()) ? null : date;
};

export const formatRelativeTime = (
	createdAt: string,
	locale?: string
): string => {
	const date = parse(createdAt);
	if (!date) {
		return '';
	}
	const lang = locale || 'de';
	const diffMin = Math.max(
		0,
		Math.floor((Date.now() - date.getTime()) / 60000)
	);
	try {
		const rtf = new Intl.RelativeTimeFormat(lang, {
			numeric: 'auto',
			style: 'short'
		});
		if (diffMin < 1) {
			// numeric:'auto' renders the idiomatic "now"/"jetzt".
			return rtf.format(0, 'second');
		}
		if (diffMin < 60) {
			return rtf.format(-diffMin, 'minute');
		}
		const diffHours = Math.floor(diffMin / 60);
		if (diffHours < 24) {
			return rtf.format(-diffHours, 'hour');
		}
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) {
			return rtf.format(-diffDays, 'day');
		}
	} catch {
		// Intl.RelativeTimeFormat unavailable — fall through to the date.
	}
	return date.toLocaleDateString(lang, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
};

/** Absolute timestamp for the detail pane, e.g. "01.08.2026, 16:48". */
export const formatAbsoluteTime = (
	createdAt: string,
	locale?: string
): string => {
	const date = parse(createdAt);
	if (!date) {
		return '';
	}
	return date.toLocaleString(locale || 'de', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
};

/** Split parts for i18n interpolation ("Wartet seit {{time}} ({{date}})"). */
export const formatClockParts = (
	createdAt: string,
	locale?: string
): { time: string; date: string } => {
	const parsed = parse(createdAt);
	if (!parsed) {
		return { time: '', date: '' };
	}
	const lang = locale || 'de';
	return {
		time: parsed.toLocaleTimeString(lang, {
			hour: '2-digit',
			minute: '2-digit'
		}),
		date: parsed.toLocaleDateString(lang, {
			day: '2-digit',
			month: '2-digit'
		})
	};
};
