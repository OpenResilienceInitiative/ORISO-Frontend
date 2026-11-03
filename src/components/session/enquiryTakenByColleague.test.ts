import { describe, expect, it } from 'vite-plus/test';
import { isEnquiryTakenByColleague } from './enquiryTakenByColleague';
import { SESSION_LIST_TYPES } from './sessionHelpers';

const session = (status: number, consultantId?: string) =>
	({
		isSession: true,
		isGroup: false,
		isEnquiry: status === 0 || status === 1,
		isRejected: status === 5,
		...(consultantId ? { consultant: { id: consultantId } } : {}),
		item: { id: 262, status }
	}) as any;

describe('isEnquiryTakenByColleague (#1472)', () => {
	it('is true when an enquiry-area case is now in progress with a colleague', () => {
		expect(
			isEnquiryTakenByColleague(
				SESSION_LIST_TYPES.ENQUIRY,
				session(2, 'colleague'),
				'me'
			)
		).toBe(true);
	});

	it.each([
		['still an open enquiry', session(1)],
		['an enquiry assigned to a colleague', session(1, 'colleague')],
		['accepted by me', session(2, 'me')],
		['rejected', session(5, 'colleague')],
		['without a known owner', session(2)],
		[
			'a group chat',
			{ ...session(2, 'colleague'), isSession: false, isGroup: true }
		],
		['missing', null]
	])('is false for a case %s', (_name, activeSession) => {
		expect(
			isEnquiryTakenByColleague(
				SESSION_LIST_TYPES.ENQUIRY,
				activeSession,
				'me'
			)
		).toBe(false);
	});

	it('is false outside the enquiry area, where colleagues open shared cases on purpose', () => {
		expect(
			isEnquiryTakenByColleague(
				SESSION_LIST_TYPES.MY_SESSION,
				session(2, 'colleague'),
				'me'
			)
		).toBe(false);
	});
});
