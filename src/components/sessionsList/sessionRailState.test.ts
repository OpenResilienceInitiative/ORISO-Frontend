import { describe, expect, it } from 'vitest';
import {
	getSessionRailMarks,
	SESSION_RAIL_MARK_ORDER
} from './sessionRailState';

/**
 * The rail pill's marks are a rendering of four EXISTING list signals. These
 * tests pin the mapping — including the cases where a source is silent, which
 * must produce no mark rather than a guess.
 */
describe('getSessionRailMarks', () => {
	it('shows nothing when no source says anything', () => {
		expect(getSessionRailMarks({})).toEqual([]);
	});

	it('shows the thread mark only when the newest message came from a thread', () => {
		expect(getSessionRailMarks({ previewChannel: 'thread' })).toEqual([
			'thread'
		]);
		// The supervision side room is a different channel, not a thread.
		expect(getSessionRailMarks({ previewChannel: 'supervision' })).toEqual(
			[]
		);
		expect(getSessionRailMarks({ previewChannel: null })).toEqual([]);
	});

	it('shows the supervision mark for both supervision states (ADR-008)', () => {
		expect(
			getSessionRailMarks({ supervisionState: 'supervisedByMe' })
		).toEqual(['supervision']);
		expect(
			getSessionRailMarks({ supervisionState: 'supervisedByOthers' })
		).toEqual(['supervision']);
		expect(getSessionRailMarks({ supervisionState: 'none' })).toEqual([]);
	});

	it('shows the mail mark only for the AGENCY_COUNSELLING modality', () => {
		expect(getSessionRailMarks({ modality: 'AGENCY_COUNSELLING' })).toEqual(
			['mail']
		);
		for (const other of ['LIVE_CHAT', 'INTERNAL_GROUP', 'SELF_HELP']) {
			expect(getSessionRailMarks({ modality: other })).toEqual([]);
		}
	});

	it('shows the unread mark only for a literal true (#1147 derives it, the DTO lies)', () => {
		expect(getSessionRailMarks({ unread: true })).toEqual(['unread']);
		expect(getSessionRailMarks({ unread: false })).toEqual([]);
		expect(getSessionRailMarks({ unread: null })).toEqual([]);
	});

	it("keeps Frank's order — thread, supervision, mail, unread — whatever the input order", () => {
		expect(
			getSessionRailMarks({
				unread: true,
				modality: 'AGENCY_COUNSELLING',
				supervisionState: 'supervisedByMe',
				previewChannel: 'thread'
			})
		).toEqual(['thread', 'supervision', 'mail', 'unread']);
		expect(SESSION_RAIL_MARK_ORDER).toEqual([
			'thread',
			'supervision',
			'mail',
			'unread'
		]);
	});

	it('never emits more marks than the pill has slots', () => {
		const all = getSessionRailMarks({
			unread: true,
			modality: 'AGENCY_COUNSELLING',
			supervisionState: 'supervisedByOthers',
			previewChannel: 'thread'
		});
		expect(all).toHaveLength(SESSION_RAIL_MARK_ORDER.length);
		expect(new Set(all).size).toBe(all.length);
	});
});
