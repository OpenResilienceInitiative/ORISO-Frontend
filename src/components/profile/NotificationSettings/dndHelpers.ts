/**
 * Global do-not-disturb (decided 2026-07-18): the counsellor mutes all
 * announcements for a chosen duration; it auto-reverts. Pure, time-injectable
 * option → ISO-timestamp mapping so the control stays testable.
 */
export type DndOption = 'off' | '1h' | '8h' | 'tomorrow';

export const DND_OPTIONS: ReadonlyArray<DndOption> = [
	'off',
	'1h',
	'8h',
	'tomorrow'
];

/**
 * Resolves a chosen option to the ISO timestamp DND should last until, or null
 * for "off". "tomorrow" means the next day at 08:00 local time.
 */
export const computeDndUntil = (
	option: DndOption,
	now: Date = new Date()
): string | null => {
	switch (option) {
		case '1h':
			return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
		case '8h':
			return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
		case 'tomorrow': {
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(8, 0, 0, 0);
			return tomorrow.toISOString();
		}
		case 'off':
		default:
			return null;
	}
};
