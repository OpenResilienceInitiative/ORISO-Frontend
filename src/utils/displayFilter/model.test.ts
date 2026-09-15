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
	resolveEffective,
	withGlobalFilter,
	withSectionOverride,
	withoutSectionOverride
} from './model';

describe('parseDisplayFilter', () => {
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
		expect(parsed.kinds.calls).toEqual({ show: false, pill: false });
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
			pill: false
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
