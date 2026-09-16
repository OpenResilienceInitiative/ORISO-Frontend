/**
 * #1377 slice 2 — display-filter model (spec §4/§7).
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DISPLAY_FILTER,
	DEFAULT_DISPLAY_FILTERS,
	DISPLAY_FILTERS_VERSION,
	isNewerDisplayFiltersVersion,
	parseDisplayFilter,
	parseDisplayFilters,
	resolveChipPresentation,
	resolveEffective,
	withGlobalFilter,
	withSectionOverride,
	withoutSectionOverride
} from './model';

describe('parseDisplayFilter', () => {
	it('round-trips the pill intent of a hidden kind (#1377 re-show fix)', () => {
		const parsed = parseDisplayFilters({
			version: 1,
			global: {},
			sections: {
				timeline: { kinds: { drafts: { show: false, pill: true } } }
			}
		});
		expect(parsed?.sections.timeline?.kinds.drafts).toEqual({
			show: false,
			pill: true
		});
	});

	it('malformed → defaults; unknown kinds kept; unknown keys ignored', () => {
		expect(parseDisplayFilter(undefined)).toEqual(DEFAULT_DISPLAY_FILTER);
		expect(parseDisplayFilter('x')).toEqual(DEFAULT_DISPLAY_FILTER);
		const parsed = parseDisplayFilter({
			kinds: {
				calls: { show: false, pill: true },
				futureKind: { show: true, pill: false },
				junk: 'no'
			},
			autoReadHidden: 'yes',
			somethingNew: 1
		});
		// The stored pill is the user's intent; hiding masks it on read only.
		expect(parsed.kinds.calls).toEqual({ show: false, pill: true });
		expect(parsed.kinds.futureKind).toEqual({ show: true, pill: false });
		expect(parsed.kinds.junk).toBeUndefined();
		expect(parsed.autoReadHidden).toBe(false);
		expect((parsed as any).somethingNew).toBeUndefined();
	});

	it('forces other.show on read and keeps only string event types', () => {
		const parsed = parseDisplayFilter({
			kinds: { other: { show: false, pill: false } },
			hiddenEventTypes: ['supervisor.renamed', 3, null]
		});
		expect(parsed.kinds.other).toEqual({ show: true, pill: false });
		expect(parsed.hiddenEventTypes).toEqual(['supervisor.renamed']);
	});
});

describe('parseDisplayFilters', () => {
	it('returns null for absent/malformed records (treated as absent)', () => {
		expect(parseDisplayFilters(undefined)).toBeNull();
		expect(parseDisplayFilters({})).toBeNull();
		expect(parseDisplayFilters({ version: '1' })).toBeNull();
	});

	it('fills every section and strips hiddenEventTypes from overrides', () => {
		const parsed = parseDisplayFilters({
			version: 1,
			global: {
				timeline: {
					kinds: { drafts: { show: false } },
					hiddenEventTypes: ['a']
				}
			},
			sections: {
				timeline: {
					kinds: { calls: { show: false } },
					hiddenEventTypes: ['must-not-survive']
				},
				bogus: { kinds: {} }
			}
		});
		expect(parsed?.global.timeline.kinds.drafts).toEqual({
			show: false,
			pill: true
		});
		expect(parsed?.global.sessions).toEqual(DEFAULT_DISPLAY_FILTER);
		expect(parsed?.global.requests).toEqual(DEFAULT_DISPLAY_FILTER);
		expect(parsed?.sections.timeline?.hiddenEventTypes).toBeUndefined();
		expect((parsed?.sections as any).bogus).toBeUndefined();
	});

	it('flags a newer version but still parses known fields', () => {
		const parsed = parseDisplayFilters({
			version: DISPLAY_FILTERS_VERSION + 1,
			global: { sessions: { autoReadHidden: true } }
		});
		expect(parsed).not.toBeNull();
		expect(isNewerDisplayFiltersVersion(parsed!)).toBe(true);
		expect(parsed?.global.sessions.autoReadHidden).toBe(true);
	});
});

describe('resolveEffective (§4)', () => {
	const base = withGlobalFilter(DEFAULT_DISPLAY_FILTERS, 'timeline', {
		kinds: { system: { show: true, pill: false } },
		autoReadHidden: false,
		hiddenEventTypes: ['supervisor.renamed']
	});

	it('is the global default without an override', () => {
		expect(resolveEffective(base, 'timeline')).toBe(base.global.timeline);
	});

	it('override wins for kinds/autoRead, profile keeps hiddenEventTypes', () => {
		const withOverride = withSectionOverride(base, 'timeline', {
			kinds: { calls: { show: false, pill: false } },
			autoReadHidden: true
		});
		const effective = resolveEffective(withOverride, 'timeline');
		expect(effective.kinds).toEqual({
			calls: { show: false, pill: false }
		});
		expect(effective.autoReadHidden).toBe(true);
		expect(effective.hiddenEventTypes).toEqual(['supervisor.renamed']);

		// Profile later hides another type → effective follows, override untouched.
		const later = withGlobalFilter(withOverride, 'timeline', {
			...withOverride.global.timeline,
			hiddenEventTypes: ['supervisor.renamed', 'counselor.renamed']
		});
		expect(resolveEffective(later, 'timeline').hiddenEventTypes).toEqual([
			'supervisor.renamed',
			'counselor.renamed'
		]);
		expect(later.sections.timeline).toEqual(withOverride.sections.timeline);
	});

	it('reset deletes the override; global writes ignore hiddenEventTypes outside timeline', () => {
		const withOverride = withSectionOverride(base, 'sessions', {
			kinds: {},
			autoReadHidden: true
		});
		expect(
			withoutSectionOverride(withOverride, 'sessions').sections
		).toEqual({});
		const sessions = withGlobalFilter(base, 'sessions', {
			kinds: {},
			autoReadHidden: true,
			hiddenEventTypes: ['x']
		});
		expect(sessions.global.sessions.hiddenEventTypes).toBeUndefined();
	});
});

describe('chip presentation (view + auto-sort, Frank 2026-09-16)', () => {
	it('defaults to icons with auto-sort on', () => {
		expect(resolveChipPresentation(DEFAULT_DISPLAY_FILTER)).toEqual({
			view: 'icons',
			autoSort: true
		});
	});

	it('parses valid values and drops malformed ones', () => {
		expect(
			parseDisplayFilter({ kinds: {}, view: 'text', autoSort: false })
		).toEqual({
			kinds: {},
			autoReadHidden: false,
			view: 'text',
			autoSort: false
		});
		expect(parseDisplayFilter({ kinds: {}, view: 'labels' }).view).toBe(
			'labels'
		);
		expect(
			parseDisplayFilter({ kinds: {}, view: 'huge', autoSort: 'yes' })
		).toEqual({ kinds: {}, autoReadHidden: false });
	});

	it('override wins, global fills the gaps', () => {
		const withGlobal = withGlobalFilter(
			DEFAULT_DISPLAY_FILTERS,
			'requests',
			{
				kinds: {},
				autoReadHidden: false,
				view: 'text'
			}
		);
		const withOverride = withSectionOverride(withGlobal, 'requests', {
			kinds: {},
			autoReadHidden: false,
			autoSort: false
		});
		expect(
			resolveChipPresentation(resolveEffective(withOverride, 'requests'))
		).toEqual({
			view: 'text',
			autoSort: false
		});
	});
});
