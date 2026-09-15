/**
 * #1377 slice 3 — Zeitstrahl helpers (spec §5.1 kinds, §6.3 badge formula).
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_FILTER, DisplayFilter } from './model';
import {
	applyTimelineFilter,
	computeTimelineBadge,
	hiddenUnreadLocalIds,
	hiddenTimelineEventTypes,
	hiddenUnreadServerIds,
	isTimelineKindPartiallyHidden,
	timelineKindOf,
	timelineUnreadByKind
} from './timeline';

const row = (id: string, eventType: string, readAt: string | null = null) => ({
	id,
	eventType,
	readAt
});

const feed = [
	row('1', 'message.new'),
	row('2', 'request.new'),
	row('3', 'supervisor.added'),
	row('4', 'supervisor.added', '2026-09-15T00:00:00Z'),
	row('5', 'totally.unknown'),
	row('local-a', 'call.started'),
	row('local-b', 'supervisor.added')
];

const hideSystem: DisplayFilter = {
	kinds: { system: { show: false, pill: false } },
	autoReadHidden: false
};

describe('timelineKindOf / applyTimelineFilter', () => {
	it('maps seeded types to their family and unknown types to "other"', () => {
		expect(timelineKindOf(row('x', 'message.new'))).toBe('messages');
		expect(timelineKindOf(row('x', 'totally.unknown'))).toBe('other');
	});

	it('hides rows of a hidden kind; "other" cannot be hidden', () => {
		expect(applyTimelineFilter(feed, hideSystem).map((r) => r.id)).toEqual([
			'1',
			'2',
			'5',
			'local-a'
		]);
		const hideOther: DisplayFilter = {
			kinds: { other: { show: false, pill: false } },
			autoReadHidden: false
		};
		expect(applyTimelineFilter(feed, hideOther)).toHaveLength(feed.length);
	});

	it('hides per-event-type from the profile list even while the kind is shown', () => {
		const filter: DisplayFilter = {
			...DEFAULT_DISPLAY_FILTER,
			hiddenEventTypes: ['supervisor.added']
		};
		expect(applyTimelineFilter(feed, filter).map((r) => r.id)).toEqual([
			'1',
			'2',
			'5',
			'local-a'
		]);
		expect(isTimelineKindPartiallyHidden(filter, 'system')).toBe(true);
		expect(isTimelineKindPartiallyHidden(filter, 'messages')).toBe(false);
		expect(isTimelineKindPartiallyHidden(hideSystem, 'system')).toBe(false);
	});

	it('an unseeded type in hiddenEventTypes is ignored: "Sonstiges" stays visible', () => {
		const filter: DisplayFilter = {
			...DEFAULT_DISPLAY_FILTER,
			hiddenEventTypes: ['totally.unknown']
		};
		expect(applyTimelineFilter(feed, filter)).toHaveLength(feed.length);
		expect(hiddenTimelineEventTypes(filter)).toEqual([]);
		expect(hiddenUnreadServerIds(feed, filter)).toEqual([]);
	});
});

describe('timelineUnreadByKind', () => {
	it('counts unread rows per kind, local rows included', () => {
		expect(timelineUnreadByKind(feed)).toEqual({
			messages: 1,
			requests: 1,
			system: 2,
			other: 1,
			calls: 1
		});
	});
});

describe('computeTimelineBadge (§6.3 v1)', () => {
	it('subtracts hidden server unread on loaded pages and adds visible local unread', () => {
		// server total 10: 3 unread server rows loaded (1,2,3 — 4 is read),
		// system hidden → hidden server unread = 1 (row 3), visible local = 1.
		const badge = computeTimelineBadge(feed, hideSystem, 10);
		expect(badge).toEqual({
			visibleUnreadCount: 10 - 1 + 1,
			hiddenServerUnreadInLoadedPages: 1
		});
	});

	it('clamps to the visible unread rows on screen when the total lags', () => {
		// Total says 1 but two visible server rows are unread locally.
		const badge = computeTimelineBadge(feed, hideSystem, 1);
		expect(badge.visibleUnreadCount).toBe(Math.max(1 - 1, 3) + 1);
	});

	it('never goes below zero and ignores read rows', () => {
		expect(computeTimelineBadge([], DEFAULT_DISPLAY_FILTER, 0)).toEqual({
			visibleUnreadCount: 0,
			hiddenServerUnreadInLoadedPages: 0
		});
		expect(
			computeTimelineBadge(
				[row('4', 'supervisor.added', 'x')],
				hideSystem,
				0
			)
		).toEqual({
			visibleUnreadCount: 0,
			hiddenServerUnreadInLoadedPages: 0
		});
	});
});

describe('slice 7 — server-side exclusions', () => {
	it('lists every seeded type of a hidden family plus the profile list, sorted', () => {
		const types = hiddenTimelineEventTypes({
			...hideSystem,
			hiddenEventTypes: ['message.new']
		});
		expect(types).toContain('supervisor.added');
		expect(types).toContain('message.new');
		expect(types).not.toContain('request.new');
		expect(types).toEqual([...types].sort());
		expect(hiddenTimelineEventTypes(DEFAULT_DISPLAY_FILTER)).toEqual([]);
	});

	it('an exact server total is neither reduced nor hinted', () => {
		const badge = computeTimelineBadge(feed, hideSystem, 4, {
			serverTotalExcludesHidden: true
		});
		expect(badge).toEqual({
			visibleUnreadCount: 4 + 1,
			hiddenServerUnreadInLoadedPages: 0
		});
	});
});

describe('auto-read id selection (§6.1)', () => {
	it('separates hidden unread server rows from hidden unread local rows', () => {
		expect(hiddenUnreadServerIds(feed, hideSystem)).toEqual(['3']);
		expect(hiddenUnreadLocalIds(feed, hideSystem)).toEqual(['local-b']);
		expect(hiddenUnreadServerIds(feed, DEFAULT_DISPLAY_FILTER)).toEqual([]);
	});
});
