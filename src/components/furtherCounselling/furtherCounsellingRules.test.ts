import { describe, expect, it } from 'vite-plus/test';
import {
	canEndTopicDuplicate,
	canRecommendFurtherCounselling,
	isTrustedRecommendationSender,
	pickPrefilledPostcode,
	resolvePostcodeMode
} from './furtherCounsellingRules';
import {
	ListItemInterface,
	STATUS_ACTIVE,
	STATUS_ENQUIRY,
	STATUS_ARCHIVED
} from '../../globalState/interfaces';

const session = (
	id: number,
	overrides: Partial<NonNullable<ListItemInterface['session']>> = {}
): ListItemInterface =>
	({
		session: {
			id,
			status: STATUS_ACTIVE,
			createDate: `2026-10-${String(id).padStart(2, '0')}T10:00:00Z`,
			topic: { id: 7, name: 'Schulden', description: '' },
			...overrides
		}
	}) as ListItemInterface;

describe('canRecommendFurtherCounselling', () => {
	const allowed = {
		isRejectedCase: false,
		isSessionOwner: true,
		isConsultant: true,
		isEnquiryList: false,
		isSession: true,
		isGroup: false,
		isSupervisor: false
	};

	it('offers the item to the owning counsellor of an accepted 1:1 chat', () => {
		expect(canRecommendFurtherCounselling(allowed)).toBe(true);
	});

	it.each([
		['a rejected case', { isRejectedCase: true }],
		[
			'a counsellor who does not own the session',
			{ isSessionOwner: false }
		],
		['an advice seeker', { isConsultant: false }],
		['the enquiry list', { isEnquiryList: true }],
		['a non-session view', { isSession: false }],
		['a group chat', { isGroup: true }],
		['a supervisor', { isSupervisor: true }]
	])('hides it for %s', (_label, change) => {
		expect(canRecommendFurtherCounselling({ ...allowed, ...change })).toBe(
			false
		);
	});
});

describe('canEndTopicDuplicate', () => {
	const older = session(1);
	const newer = session(5);

	it('offers it in the newer of two running chats on the same topic', () => {
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: newer.session,
				sessions: [older, newer]
			})
		).toBe(true);
	});

	it('never offers it in the older chat', () => {
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: older.session,
				sessions: [older, newer]
			})
		).toBe(false);
	});

	it('never offers it to a counsellor', () => {
		expect(
			canEndTopicDuplicate({
				isAsker: false,
				current: newer.session,
				sessions: [older, newer]
			})
		).toBe(false);
	});

	it('needs the other chat to be on the same topic', () => {
		const otherTopic = session(1, {
			topic: { id: 8, name: 'Familie', description: '' }
		});
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: newer.session,
				sessions: [otherTopic, newer]
			})
		).toBe(false);
	});

	it('needs both chats to be running', () => {
		for (const status of [STATUS_ENQUIRY, STATUS_ARCHIVED] as const) {
			expect(
				canEndTopicDuplicate({
					isAsker: true,
					current: newer.session,
					sessions: [session(1, { status }), newer]
				})
			).toBe(false);
			expect(
				canEndTopicDuplicate({
					isAsker: true,
					current: { ...newer.session, status },
					sessions: [older, { session: { ...newer.session, status } }]
				})
			).toBe(false);
		}
	});

	it('uses the main topic id when the topic object is missing', () => {
		const a = session(1, { topic: undefined, mainTopicId: 4 });
		const b = session(2, { topic: undefined, mainTopicId: 4 });
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: b.session,
				sessions: [a, b]
			})
		).toBe(true);
	});

	it('orders by session id when the creation dates are equal or missing', () => {
		const a = session(3, { createDate: undefined });
		const b = session(4, { createDate: undefined });
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: b.session,
				sessions: [a, b]
			})
		).toBe(true);
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: a.session,
				sessions: [a, b]
			})
		).toBe(false);
	});

	it('follows the backend flag when it is present', () => {
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: { ...newer.session, isTopicDuplicate: false },
				sessions: [older, newer]
			})
		).toBe(false);
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: { ...older.session, isTopicDuplicate: true },
				sessions: [older]
			})
		).toBe(true);
	});

	it('still requires a running asker chat when the backend flag is set', () => {
		expect(
			canEndTopicDuplicate({
				isAsker: false,
				current: { ...newer.session, isTopicDuplicate: true },
				sessions: []
			})
		).toBe(false);
		expect(
			canEndTopicDuplicate({
				isAsker: true,
				current: {
					...newer.session,
					status: STATUS_ENQUIRY,
					isTopicDuplicate: true
				},
				sessions: []
			})
		).toBe(false);
	});

	it('hides it without a current session', () => {
		expect(
			canEndTopicDuplicate({ isAsker: true, current: null, sessions: [] })
		).toBe(false);
	});
});

describe('postcode prefill', () => {
	it('defaults to SMART when the setting is missing or unknown', () => {
		expect(resolvePostcodeMode(undefined)).toBe('SMART');
		expect(resolvePostcodeMode('SOMETHING')).toBe('SMART');
		expect(resolvePostcodeMode('ALWAYS_EMPTY')).toBe('ALWAYS_EMPTY');
	});

	it('SMART takes the postcode of the most recent session that has one', () => {
		const sessions = [
			session(1, { postcode: 10115 }),
			session(9, { postcode: 1067 }),
			session(5, { postcode: 80331 }),
			session(12, { postcode: undefined })
		];
		expect(pickPrefilledPostcode(sessions, 'SMART')).toBe('01067');
	});

	it('SMART leaves the field empty when no session has a postcode', () => {
		expect(
			pickPrefilledPostcode(
				[session(1, { postcode: undefined })],
				'SMART'
			)
		).toBeUndefined();
		expect(pickPrefilledPostcode([], 'SMART')).toBeUndefined();
	});

	it('ALWAYS_EMPTY never prefills', () => {
		expect(
			pickPrefilledPostcode(
				[session(1, { postcode: 10115 })],
				'ALWAYS_EMPTY'
			)
		).toBeUndefined();
	});
});

describe('isTrustedRecommendationSender', () => {
	it('trusts exactly the assigned counsellor of the session', () => {
		expect(
			isTrustedRecommendationSender({
				senderId: '@consultant:m.test',
				consultantMatrixUserId: '@consultant:m.test'
			})
		).toBe(true);
	});

	it('does not trust any other room member', () => {
		for (const senderId of ['@team-colleague:m.test', '@asker:m.test']) {
			expect(
				isTrustedRecommendationSender({
					senderId,
					consultantMatrixUserId: '@consultant:m.test'
				})
			).toBe(false);
		}
	});

	it('fails closed when the counsellor id is unknown', () => {
		for (const consultantMatrixUserId of [undefined, null, '']) {
			expect(
				isTrustedRecommendationSender({
					senderId: '@someone:m.test',
					consultantMatrixUserId
				})
			).toBe(false);
		}
		expect(
			isTrustedRecommendationSender({
				senderId: '',
				consultantMatrixUserId: ''
			})
		).toBe(false);
	});
});
