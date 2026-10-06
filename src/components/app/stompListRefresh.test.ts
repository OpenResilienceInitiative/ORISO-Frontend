import { describe, expect, it } from 'vitest';
import { resolveStompListRefresh } from './stompListRefresh';

describe('resolveStompListRefresh (#1206: which live events must refetch a list)', () => {
	it('refetches the enquiry list for a new anonymous enquiry', () => {
		expect(resolveStompListRefresh('newAnonymousEnquiry')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: false
		});
	});

	it('refetches BOTH lists when an enquiry is accepted (request → chat)', () => {
		// The accepted enquiry leaves every counsellor's request list and
		// enters the assignee's conversation list. Before #1206 this event only
		// raised a toast, so both lists stayed stale until a hard reload.
		expect(resolveStompListRefresh('anonymousEnquiryAccepted')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: true
		});
	});

	it('refetches both lists when a conversation finishes', () => {
		expect(
			resolveStompListRefresh('anonymousConversationFinished')
		).toEqual({ refreshEnquiryList: true, refreshSessionList: true });
	});

	it('accepts the upper-case spellings the backend also sends', () => {
		expect(resolveStompListRefresh('ANONYMOUSENQUIRYACCEPTED')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: true
		});
		expect(resolveStompListRefresh('NEWANONYMOUSENQUIRY')).toEqual({
			refreshEnquiryList: true,
			refreshSessionList: false
		});
	});

	it('leaves events that do not change list membership alone', () => {
		expect(resolveStompListRefresh('directMessage')).toBeNull();
		expect(resolveStompListRefresh('videoCallRequest')).toBeNull();
		expect(resolveStompListRefresh('')).toBeNull();
		expect(resolveStompListRefresh(undefined as never)).toBeNull();
	});
});
