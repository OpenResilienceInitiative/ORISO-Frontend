/**
 * ORISO-Frontend#2142: the date and time a counsellor notes on a direct
 * link ("Termin Frau M., Fr 14:30"). Informational only: the link works
 * before and after it, and it is no calendar entry (that is epic #974).
 * The input works in local time, UserService stores an ISO instant.
 */

/** `datetime-local` value ("2026-11-20T14:30") → ISO instant, or undefined. */
export const toScheduledAt = (localValue: string): string | undefined => {
	if (!localValue) return undefined;
	const date = new Date(localValue);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO instant → `datetime-local` value in local time, '' when absent. */
export const toLocalInputValue = (iso: string | undefined | null): string => {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Date and time for the overview tile, in the app language. */
export const formatScheduledAt = (
	iso: string | undefined | null,
	language?: string
): string => {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	try {
		return new Intl.DateTimeFormat(language || 'de', {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	} catch {
		return date.toLocaleString();
	}
};
