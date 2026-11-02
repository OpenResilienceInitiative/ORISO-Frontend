/**
 * Timeline display settings (ADR-021): how the conversation list shows the
 * future. Stored in Matrix account data next to the display filters, so a
 * choice made on one device holds on every other.
 */

/** Two panes split at "Jetzt", or one timeline with a pull to release the future. */
export type TimelineScrollModel = 'panes' | 'single';
/** Where a past card shows its date: in the card's corner, own line, or not at all. */
export type TimelinePastDate = 'corner' | 'line' | 'off';
/** How far the future opens on its own when appointments are coming up (= the handle's stops). */
export type TimelineReveal = 'none' | 'next' | 'half' | 'most';

export const TIMELINE_SETTINGS_VERSION = 1;

export interface TimelineSettings {
	version: number;
	scrollModel: TimelineScrollModel;
	pastDate: TimelinePastDate;
	reveal: TimelineReveal;
}

export const DEFAULT_TIMELINE_SETTINGS: TimelineSettings = {
	version: TIMELINE_SETTINGS_VERSION,
	scrollModel: 'panes',
	pastDate: 'corner',
	reveal: 'none'
};

const SCROLL_MODELS: readonly TimelineScrollModel[] = ['panes', 'single'];
const PAST_DATES: readonly TimelinePastDate[] = ['corner', 'line', 'off'];
const REVEALS: readonly TimelineReveal[] = ['none', 'next', 'half', 'most'];

const pick = <T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T
): T =>
	typeof value === 'string' && (allowed as readonly string[]).includes(value)
		? (value as T)
		: fallback;

/**
 * Lenient: a value this client does not know falls back to its default,
 * so a record written by a newer client never breaks the list.
 */
export const parseTimelineSettings = (raw: unknown): TimelineSettings => {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return DEFAULT_TIMELINE_SETTINGS;
	}
	const record = raw as Record<string, unknown>;
	const d = DEFAULT_TIMELINE_SETTINGS;
	return {
		version:
			typeof record.version === 'number'
				? record.version
				: TIMELINE_SETTINGS_VERSION,
		scrollModel: pick(record.scrollModel, SCROLL_MODELS, d.scrollModel),
		pastDate: pick(record.pastDate, PAST_DATES, d.pastDate),
		reveal: pick(record.reveal, REVEALS, d.reveal)
	};
};

export const isNewerTimelineSettingsVersion = (
	settings: TimelineSettings
): boolean => settings.version > TIMELINE_SETTINGS_VERSION;

export const TIMELINE_SETTING_OPTIONS = {
	scrollModel: SCROLL_MODELS,
	pastDate: PAST_DATES,
	reveal: REVEALS
} as const;
