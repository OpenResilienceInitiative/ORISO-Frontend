/**
 * WP-06 Activity Timeline — unit coverage for the client-side timeline filter
 * (Slice 1). Pure-logic vitest spec; runs in CI via `npm run test:unit`.
 */

import { describe, it, expect } from 'vitest';
import {
	filterTimelineItems,
	getFamiliesInFeed,
	TIMELINE_FAMILY_ORDER
} from './timelineFilter';

// Minimal feed items: only `eventType` + a `text` used as the search source.
const feed = [
	{ id: '1', eventType: 'message.new', text: 'New message from Anna' },
	{ id: '2', eventType: 'thread.reply.new', text: 'Reply in thread' },
	{ id: '3', eventType: 'request.new', text: 'New client request' },
	{ id: '4', eventType: 'handover.requested', text: 'Handover requested' },
	{ id: '5', eventType: 'call.started', text: 'Call ongoing' },
	{ id: '6', eventType: 'supervisor.added', text: 'Supervisor added' },
	{ id: '7', eventType: 'draft.created', text: 'Draft saved' },
	{ id: '8', eventType: 'some.unknown.type', text: 'Mystery event' }
];

const searchText = (item: { text: string }) => item.text;
const ids = (items: ReadonlyArray<{ id: string }>) => items.map((i) => i.id);

describe('WP-06 timeline filter', () => {
	describe('getFamiliesInFeed', () => {
		it('returns the present families in canonical order, deduped', () => {
			const families = getFamiliesInFeed(feed);
			// messages (2 items) appears once; order follows TIMELINE_FAMILY_ORDER.
			expect(families).to.deep.equal([
				'requests',
				'messages',
				'drafts',
				'handover',
				'calls',
				'system'
			]);
		});

		it('maps unknown event types to the system family', () => {
			expect(getFamiliesInFeed([{ eventType: 'nope' }])).to.deep.equal([
				'system'
			]);
		});

		it('returns an empty list for an empty feed', () => {
			expect(getFamiliesInFeed([])).to.deep.equal([]);
		});

		it('only lists families from the canonical order', () => {
			getFamiliesInFeed(feed).forEach((family) =>
				expect(TIMELINE_FAMILY_ORDER).to.include(family)
			);
		});
	});

	describe('filterTimelineItems', () => {
		it('"all" with no query returns everything (stable order)', () => {
			expect(
				ids(filterTimelineItems(feed, { family: 'all', query: '' }, searchText))
			).to.deep.equal(['1', '2', '3', '4', '5', '6', '7', '8']);
		});

		it('filters to a single family chip', () => {
			expect(
				ids(
					filterTimelineItems(
						feed,
						{ family: 'messages', query: '' },
						searchText
					)
				)
			).to.deep.equal(['1', '2']);
			expect(
				ids(
					filterTimelineItems(
						feed,
						{ family: 'handover', query: '' },
						searchText
					)
				)
			).to.deep.equal(['4']);
		});

		it('puts unknown event types under the system chip', () => {
			expect(
				ids(
					filterTimelineItems(
						feed,
						{ family: 'system', query: '' },
						searchText
					)
				)
			).to.include('8');
		});

		it('search is a case-insensitive substring over getSearchText', () => {
			expect(
				ids(filterTimelineItems(feed, { family: 'all', query: 'ANNA' }, searchText))
			).to.deep.equal(['1']);
			expect(
				ids(
					filterTimelineItems(
						feed,
						{ family: 'all', query: 'client request' },
						searchText
					)
				)
			).to.deep.equal(['3']);
			// substring match is literal: "requested" also contains "request"
			expect(
				ids(
					filterTimelineItems(
						feed,
						{ family: 'all', query: 'request' },
						searchText
					)
				)
			).to.deep.equal(['3', '4']);
		});

		it('combines family chip AND search', () => {
			expect(
				ids(
					filterTimelineItems(
						feed,
						{ family: 'messages', query: 'reply' },
						searchText
					)
				)
			).to.deep.equal(['2']);
			// query matches a different family → excluded by the chip
			expect(
				filterTimelineItems(
					feed,
					{ family: 'messages', query: 'handover' },
					searchText
				)
			).to.have.length(0);
		});

		it('ignores a whitespace-only query', () => {
			expect(
				filterTimelineItems(feed, { family: 'all', query: '   ' }, searchText)
			).to.have.length(feed.length);
		});

		it('returns an empty array when nothing matches', () => {
			expect(
				filterTimelineItems(
					feed,
					{ family: 'all', query: 'zzz-no-match' },
					searchText
				)
			).to.have.length(0);
		});
	});
});
