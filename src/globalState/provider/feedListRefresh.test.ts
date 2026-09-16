import { describe, expect, it } from 'vitest';
import {
	listRefreshForFeedEvent,
	listRefreshForFeedItems,
	pickUnseenFeedItems
} from './feedListRefresh';

describe('listRefreshForFeedEvent (#1206: feed events that change list membership)', () => {
	it('refreshes the request list for a new registered enquiry', () => {
		expect(listRefreshForFeedEvent('request.new')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: false
		});
	});

	it('refreshes the request list when an anonymous client joins the waiting room', () => {
		expect(listRefreshForFeedEvent('waiting_room.client.joined')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: false
		});
	});

	it('refreshes both lists when an enquiry is accepted', () => {
		expect(listRefreshForFeedEvent('inquiry.accepted')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: true
		});
	});

	it('refreshes both lists when a conversation is finished', () => {
		expect(listRefreshForFeedEvent('conversation.finished')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: true
		});
	});

	it('ignores events that only touch an existing session', () => {
		expect(listRefreshForFeedEvent('message.new')).toBeNull();
		expect(listRefreshForFeedEvent('thread.reply.new')).toBeNull();
		expect(listRefreshForFeedEvent('supervisor.added')).toBeNull();
		expect(listRefreshForFeedEvent('')).toBeNull();
		expect(listRefreshForFeedEvent(undefined)).toBeNull();
	});
});

describe('listRefreshForFeedItems', () => {
	it('returns null for a batch without membership changes', () => {
		expect(
			listRefreshForFeedItems([
				{ eventType: 'message.new' },
				{ eventType: 'counselor.renamed' }
			])
		).toBeNull();
	});

	it('unions the flags of a mixed batch', () => {
		expect(
			listRefreshForFeedItems([
				{ eventType: 'message.new' },
				{ eventType: 'request.new' },
				{ eventType: 'inquiry.accepted' }
			])
		).toEqual({ refreshEnquiryList: true, refreshSessionList: true });
	});

	it('keeps the session list untouched for request-only events', () => {
		expect(
			listRefreshForFeedItems([
				{ eventType: 'request.new' },
				{ eventType: 'waiting_room.client.joined' }
			])
		).toEqual({ refreshEnquiryList: true, refreshSessionList: false });
	});
});

describe('pickUnseenFeedItems', () => {
	it('returns only rows whose id is unknown, comparing ids as strings', () => {
		const known = new Set(['1', '2']);
		expect(
			pickUnseenFeedItems([{ id: 1 }, { id: '2' }, { id: 3 }], known)
		).toEqual([{ id: 3 }]);
	});

	it('returns nothing when every row is known', () => {
		expect(pickUnseenFeedItems([{ id: 7 }], new Set(['7']))).toEqual([]);
	});
});
