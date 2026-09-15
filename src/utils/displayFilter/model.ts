/**
 * Display filter — model (#1377 slice 2, spec §4/§7).
 *
 * Pure data: the account-data record, tolerant parsing, and the resolution
 * of the effective filter for one section (global default → optional
 * override). No transport here; see `store.ts`.
 */

import {
	DEFAULT_KIND_SETTING,
	DisplayFilterValue,
	KindSetting,
	OTHER_KIND_ID
} from '../../components/displayFilter/displayFilterTypes';

export type DisplayFilterSection = 'timeline' | 'sessions' | 'requests';

export const DISPLAY_FILTER_SECTIONS: ReadonlyArray<DisplayFilterSection> = [
	'timeline',
	'sessions',
	'requests'
];

/** The version this client can read AND write. */
export const DISPLAY_FILTERS_VERSION = 1;

/**
 * One section's filter. Extends the dialog's value with the profile-owned
 * per-event-type list (spec §7): `hiddenEventTypes` lives in
 * `global.timeline` only, an override never carries it (§4).
 */
export interface DisplayFilter extends DisplayFilterValue {
	hiddenEventTypes?: string[];
}

export interface OrisoDisplayFilters {
	version: number;
	/** Per-section defaults, edited in the profile. Always complete. */
	global: Record<DisplayFilterSection, DisplayFilter>;
	/** Optional per-section override, edited in the list dialog. */
	sections: Partial<Record<DisplayFilterSection, DisplayFilter>>;
}

export const DEFAULT_DISPLAY_FILTER: DisplayFilter = {
	kinds: {},
	autoReadHidden: false
};

export const DEFAULT_DISPLAY_FILTERS: OrisoDisplayFilters = {
	version: DISPLAY_FILTERS_VERSION,
	global: {
		timeline: DEFAULT_DISPLAY_FILTER,
		sessions: DEFAULT_DISPLAY_FILTER,
		requests: DEFAULT_DISPLAY_FILTER
	},
	sections: {}
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const parseKindSetting = (raw: unknown): KindSetting | null => {
	if (!isRecord(raw)) {
		return null;
	}
	const show =
		typeof raw.show === 'boolean' ? raw.show : DEFAULT_KIND_SETTING.show;
	const pill =
		typeof raw.pill === 'boolean' ? raw.pill : DEFAULT_KIND_SETTING.pill;
	return { show, pill: show && pill };
};

/**
 * Tolerant parse of one section filter (like `parseNotificationConfig`):
 * unknown kinds are kept (a newer client may know them), unknown keys are
 * ignored, malformed values fall back to the defaults. `other.show` is
 * forced true on read.
 */
export const parseDisplayFilter = (raw: unknown): DisplayFilter => {
	if (!isRecord(raw)) {
		return DEFAULT_DISPLAY_FILTER;
	}
	const kinds: Partial<Record<string, KindSetting>> = {};
	if (isRecord(raw.kinds)) {
		Object.entries(raw.kinds).forEach(([kindId, setting]) => {
			const parsed = parseKindSetting(setting);
			if (parsed) {
				kinds[kindId] =
					kindId === OTHER_KIND_ID
						? { show: true, pill: parsed.pill }
						: parsed;
			}
		});
	}
	const filter: DisplayFilter = {
		kinds,
		autoReadHidden: raw.autoReadHidden === true
	};
	if (Array.isArray(raw.hiddenEventTypes)) {
		filter.hiddenEventTypes = raw.hiddenEventTypes.filter(
			(type): type is string => typeof type === 'string'
		);
	}
	return filter;
};

/**
 * Parses the account-data blob. Returns `null` when the content is not a
 * v-something record at all (no object, no numeric `version`) — the caller
 * treats that as "absent" (defaults; the first write replaces it). A record
 * with a NEWER version than this client supports is still parsed for its
 * known fields (read-only mode is decided by the caller from `version`).
 */
export const parseDisplayFilters = (
	raw: unknown
): OrisoDisplayFilters | null => {
	if (!isRecord(raw) || typeof raw.version !== 'number') {
		return null;
	}
	const global = isRecord(raw.global) ? raw.global : {};
	const sections = isRecord(raw.sections) ? raw.sections : {};
	const parsed: OrisoDisplayFilters = {
		version: raw.version,
		global: {
			timeline: parseDisplayFilter(global.timeline),
			sessions: parseDisplayFilter(global.sessions),
			requests: parseDisplayFilter(global.requests)
		},
		sections: {}
	};
	DISPLAY_FILTER_SECTIONS.forEach((section) => {
		if (isRecord(sections[section])) {
			const override = parseDisplayFilter(sections[section]);
			// An override never carries the profile-owned list (§4).
			delete override.hiddenEventTypes;
			parsed.sections[section] = override;
		}
	});
	return parsed;
};

/** True when a record's version is newer than this client can write. */
export const isNewerDisplayFiltersVersion = (
	filters: Pick<OrisoDisplayFilters, 'version'>
): boolean => filters.version > DISPLAY_FILTERS_VERSION;

/**
 * Spec §4: `effective = { ...global, ...override, hiddenEventTypes:
 * global.hiddenEventTypes }` — the override wins for what the dialog can
 * edit, the profile keeps the per-event-type list even while an override
 * exists.
 */
export const resolveEffective = (
	filters: OrisoDisplayFilters,
	section: DisplayFilterSection
): DisplayFilter => {
	const global = filters.global[section] ?? DEFAULT_DISPLAY_FILTER;
	const override = filters.sections[section];
	if (!override) {
		return global;
	}
	const effective: DisplayFilter = {
		kinds: override.kinds,
		autoReadHidden: override.autoReadHidden
	};
	if (global.hiddenEventTypes) {
		effective.hiddenEventTypes = global.hiddenEventTypes;
	}
	return effective;
};

/** The dialog-editable part of a filter (never `hiddenEventTypes`). */
export const toDisplayFilterValue = (
	filter: DisplayFilter
): DisplayFilterValue => ({
	kinds: filter.kinds,
	autoReadHidden: filter.autoReadHidden
});

/**
 * Immutable writers. Each returns a new record with `version` pinned to the
 * supported one; the store spreads unknown top-level keys of the stored
 * record over the result so nothing a newer field wrote is lost (§7).
 */
export const withSectionOverride = (
	filters: OrisoDisplayFilters,
	section: DisplayFilterSection,
	value: DisplayFilterValue
): OrisoDisplayFilters => ({
	...filters,
	sections: {
		...filters.sections,
		[section]: { kinds: value.kinds, autoReadHidden: value.autoReadHidden }
	}
});

export const withoutSectionOverride = (
	filters: OrisoDisplayFilters,
	section: DisplayFilterSection
): OrisoDisplayFilters => {
	const sections = { ...filters.sections };
	delete sections[section];
	return { ...filters, sections };
};

export const withGlobalFilter = (
	filters: OrisoDisplayFilters,
	section: DisplayFilterSection,
	filter: DisplayFilter
): OrisoDisplayFilters => {
	const next: DisplayFilter = {
		kinds: filter.kinds,
		autoReadHidden: filter.autoReadHidden
	};
	// Only the timeline carries per-event-type hiding (§7).
	if (section === 'timeline' && filter.hiddenEventTypes) {
		next.hiddenEventTypes = filter.hiddenEventTypes;
	}
	return {
		...filters,
		global: { ...filters.global, [section]: next }
	};
};
