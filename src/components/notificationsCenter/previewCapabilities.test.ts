// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	type PreviewPolicyInput,
	resolvePreviewCapabilities
} from './previewCapabilities';

const ROOM = '!room:x';

const session = (overrides: Record<string, any> = {}): any => {
	const { item, ...rest } = overrides;
	return {
		rid: ROOM,
		consultant: { id: 'me' },
		isSession: true,
		...rest,
		item: { id: 13, status: 2, matrixRoomId: ROOM, ...item }
	};
};

const counsellor = (
	overrides: Partial<PreviewPolicyInput> = {}
): PreviewPolicyInput => ({
	session: session(),
	roomKind: 'main',
	channelKind: null,
	viewer: { userId: 'me', isConsultant: true },
	isSupervisorOfSession: false,
	caseHandover: 'notRequired',
	roomJoined: true,
	privacyAcceptanceRecorded: true,
	isAnonymousChat: false,
	teamDiscussionOpen: false,
	threadsEnabled: true,
	stillLoading: false,
	anonymousGateBlocked: false,
	groupJoinBlocked: false,
	...overrides
});

const asker = (overrides: Partial<PreviewPolicyInput> = {}) =>
	counsellor({
		session: session({ consultant: { id: 'counsellor' } }),
		viewer: { userId: 'asker', isConsultant: false },
		...overrides
	});

const NOTHING = {
	composer: false,
	react: false,
	manageOwn: false,
	threadReply: false
};

const resolve = resolvePreviewCapabilities;

describe('resolvePreviewCapabilities (#1824: one row per room type)', () => {
	it('one-to-one session, counsellor: reply, react, edit/delete own, thread reply', () => {
		expect(resolve(counsellor())).toEqual({
			composer: true,
			react: true,
			manageOwn: true,
			threadReply: true,
			readOnlyReason: null,
			contentHidden: false
		});
	});

	it('one-to-one session, advice seeker: the same', () => {
		expect(resolve(asker())).toMatchObject({
			composer: true,
			react: true,
			manageOwn: true,
			threadReply: true
		});
	});

	it('thread reply follows the tenant thread setting', () => {
		expect(resolve(counsellor({ threadsEnabled: false })).threadReply).toBe(
			false
		);
	});

	it('archived: read only, never re-opened', () => {
		expect(
			resolve(counsellor({ session: session({ isArchive: true }) }))
		).toMatchObject({ ...NOTHING, readOnlyReason: 'archived' });
	});

	it('enquiry not yet accepted: read only', () => {
		expect(
			resolve(counsellor({ session: session({ isEnquiry: true }) }))
		).toMatchObject({ ...NOTHING, readOnlyReason: 'enquiry' });
	});

	describe('group / self-help group', () => {
		const group = () => session({ isGroup: true, isSession: false });

		it('member: reply, react, edit/delete own, thread reply', () => {
			expect(resolve(asker({ session: group() }))).toMatchObject({
				composer: true,
				manageOwn: true,
				threadReply: true
			});
		});

		it('knock pending or not synced: read only with a notice', () => {
			expect(
				resolve(asker({ session: group(), roomJoined: false }))
			).toMatchObject({ ...NOTHING, readOnlyReason: 'notJoined' });
		});

		it('asker without recorded consent: the chat’s consent gate', () => {
			expect(
				resolve(
					asker({
						session: group(),
						privacyAcceptanceRecorded: false
					})
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'consentGate' });
		});
	});

	describe('supervision side room', () => {
		it('reply, react, edit/delete own — no thread', () => {
			expect(resolve(counsellor({ roomKind: 'supervision' }))).toEqual({
				composer: true,
				react: true,
				manageOwn: true,
				threadReply: false,
				readOnlyReason: null,
				contentHidden: false
			});
		});

		it('also for the supervisor', () => {
			expect(
				resolve(
					counsellor({
						roomKind: 'supervision',
						session: session({ consultant: { id: 'owner' } }),
						isSupervisorOfSession: true
					})
				).composer
			).toBe(true);
		});

		it('never for an advice seeker', () => {
			expect(resolve(asker({ roomKind: 'supervision' }))).toMatchObject({
				...NOTHING,
				readOnlyReason: 'sessionUnknown'
			});
		});

		it('read only while not joined', () => {
			expect(
				resolve(
					counsellor({ roomKind: 'supervision', roomJoined: false })
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'notJoined' });
		});
	});

	it('supervisor in the main room: react only, no composer', () => {
		expect(
			resolve(
				counsellor({
					session: session({ consultant: { id: 'owner' } }),
					isSupervisorOfSession: true
				})
			)
		).toMatchObject({
			composer: false,
			react: true,
			manageOwn: false,
			threadReply: false,
			readOnlyReason: 'supervisor'
		});
	});

	describe('team discussion', () => {
		it('while OPEN: reply, react, edit/delete own', () => {
			expect(
				resolve(
					counsellor({ roomKind: 'team', teamDiscussionOpen: true })
				)
			).toMatchObject({
				composer: true,
				react: true,
				manageOwn: true,
				threadReply: false
			});
		});

		it('also in an enquiry (the team talks before anyone accepts it)', () => {
			expect(
				resolve(
					counsellor({
						roomKind: 'team',
						teamDiscussionOpen: true,
						session: session({ isEnquiry: true })
					})
				).composer
			).toBe(true);
		});

		it('closed: read only', () => {
			expect(resolve(counsellor({ roomKind: 'team' }))).toMatchObject({
				...NOTHING,
				readOnlyReason: 'teamClosed'
			});
		});
	});

	describe('anonymous live chat', () => {
		it('reply and react, no edit/delete, no thread', () => {
			expect(resolve(asker({ isAnonymousChat: true }))).toMatchObject({
				composer: true,
				react: true,
				manageOwn: false,
				threadReply: false
			});
		});

		it('blocked while the asker’s consent is not on record', () => {
			expect(
				resolve(
					asker({
						isAnonymousChat: true,
						privacyAcceptanceRecorded: false
					})
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'consentGate' });
		});
	});

	it('thread: thread reply and react, nothing else', () => {
		expect(resolve(counsellor({ channelKind: 'thread' }))).toMatchObject({
			composer: true,
			react: true,
			manageOwn: false,
			threadReply: false
		});
	});

	describe('case handover', () => {
		it('co-access: nothing, with the co-access notice', () => {
			expect(
				resolve(
					counsellor({
						session: session({ consultant: { id: 'owner' } }),
						caseHandover: { canViewContent: true, coAccess: true }
					})
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'coAccess' });
		});

		it('curtained: the content stays hidden', () => {
			expect(
				resolve(
					counsellor({
						session: session({ consultant: { id: 'owner' } }),
						caseHandover: { canViewContent: false, coAccess: false }
					})
				)
			).toMatchObject({
				...NOTHING,
				readOnlyReason: 'curtained',
				contentHidden: true
			});
		});

		it('a colleague the chat lets write may write here too', () => {
			expect(
				resolve(
					counsellor({
						session: session({ consultant: { id: 'owner' } }),
						caseHandover: { canViewContent: true, coAccess: false }
					})
				).composer
			).toBe(true);
		});

		it('read only while the status is still loading', () => {
			expect(
				resolve(counsellor({ caseHandover: 'loading' }))
			).toMatchObject({ ...NOTHING, readOnlyReason: 'sessionUnknown' });
		});
	});

	describe('fails closed', () => {
		it.each([
			['no session', { session: null }],
			['a room that is none of the session’s rooms', { roomKind: null }],
			[
				'user data not loaded',
				{ viewer: { userId: undefined, isConsultant: undefined } }
			]
		] as const)('%s', (_, overrides) => {
			expect(resolve(counsellor(overrides as any))).toMatchObject({
				...NOTHING,
				readOnlyReason: 'sessionUnknown'
			});
		});
	});

	describe('review round 2 (#1824)', () => {
		it('anonymous live chat: blocked while the chat’s pseudonym/waiting gate is up', () => {
			expect(
				resolve(
					asker({ isAnonymousChat: true, anonymousGateBlocked: true })
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'consentGate' });
		});

		it('group: the chat’s join view (stopped, not subscribed, banned) blocks too', () => {
			expect(
				resolve(
					asker({
						session: session({ isGroup: true, isSession: false }),
						groupJoinBlocked: true
					})
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'notJoined' });
		});

		it('a main room that the event calls a side channel fails closed', () => {
			for (const channelKind of ['supervision', 'team'] as const) {
				expect(resolve(counsellor({ channelKind }))).toMatchObject({
					...NOTHING,
					readOnlyReason: 'sessionUnknown'
				});
			}
		});

		it('nothing while facts are still loading (supervisors, group info)', () => {
			expect(resolve(counsellor({ stillLoading: true }))).toMatchObject({
				...NOTHING,
				readOnlyReason: 'sessionUnknown'
			});
		});

		it('team room of an archived session: read only', () => {
			expect(
				resolve(
					counsellor({
						roomKind: 'team',
						teamDiscussionOpen: true,
						session: session({ isArchive: true })
					})
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'archived' });
		});

		it('co-access applies in every room of the case', () => {
			expect(
				resolve(
					counsellor({
						roomKind: 'team',
						teamDiscussionOpen: true,
						caseHandover: { canViewContent: true, coAccess: true }
					})
				)
			).toMatchObject({ ...NOTHING, readOnlyReason: 'coAccess' });
		});

		it('the content stays hidden until the handover status is known', () => {
			expect(
				resolve(counsellor({ caseHandover: 'loading' })).contentHidden
			).toBe(true);
		});
	});
});
