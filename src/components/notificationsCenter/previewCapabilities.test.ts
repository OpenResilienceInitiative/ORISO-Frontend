// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolvePreviewCapabilities } from './previewCapabilities';

const ROOM = '!room:matrix.example';

const session = (overrides: Record<string, any> = {}): any => ({
	rid: ROOM,
	item: { id: 13, status: 2, matrixRoomId: ROOM, ...overrides.item },
	consultant: { id: 'me' },
	isSession: true,
	...overrides,
	// keep the merged item above
	...(overrides.item
		? { item: { id: 13, status: 2, matrixRoomId: ROOM, ...overrides.item } }
		: {})
});

const resolve = (overrides: Record<string, any> = {}) =>
	resolvePreviewCapabilities({
		session: session(),
		roomId: ROOM,
		userId: 'me',
		channelKind: null,
		roomJoined: true,
		viewerIsAdviceSeeker: false,
		privacyAcceptanceRecorded: true,
		...overrides
	});

const READ_ONLY = {
	composer: false,
	react: false,
	manageOwn: false
};

describe('resolvePreviewCapabilities (#1824)', () => {
	it('own one-to-one session: composer, react, edit/delete own', () => {
		expect(resolve()).toEqual({
			composer: true,
			react: true,
			manageOwn: true,
			readOnlyReason: null
		});
	});

	describe('fails closed', () => {
		it('without a session', () => {
			expect(resolve({ session: null })).toMatchObject({
				...READ_ONLY,
				readOnlyReason: 'sessionUnknown'
			});
		});

		it('when the session belongs to another room (id collision)', () => {
			const other = session({
				rid: '!other:matrix.example',
				item: { matrixRoomId: '!other:matrix.example' }
			});
			expect(resolve({ session: other })).toMatchObject({
				...READ_ONLY,
				readOnlyReason: 'sessionUnknown'
			});
		});

		it('while the user data has not loaded', () => {
			expect(resolve({ viewerIsAdviceSeeker: undefined })).toMatchObject({
				...READ_ONLY,
				readOnlyReason: 'sessionUnknown'
			});
		});

		it.each(['supervision', 'team'] as const)(
			'for the internal %s room until S6 (D5)',
			(channelKind) => {
				expect(resolve({ channelKind })).toMatchObject({
					...READ_ONLY,
					readOnlyReason: 'internalRoom'
				});
			}
		);
	});

	it('archived: read only, never re-opened', () => {
		expect(
			resolve({
				session: session({ isArchive: true })
			})
		).toMatchObject({ ...READ_ONLY, readOnlyReason: 'archived' });
	});

	it('enquiry: read only', () => {
		expect(
			resolve({ session: session({ isEnquiry: true }) })
		).toMatchObject({ ...READ_ONLY, readOnlyReason: 'enquiry' });
	});

	it('a consultant who does not own the case is read only', () => {
		expect(
			resolve({ session: session({ consultant: { id: 'other' } }) })
		).toMatchObject({ ...READ_ONLY, readOnlyReason: 'coAccess' });
	});

	it('an active supervisor can react but not write', () => {
		const supervised = session({
			consultant: { id: 'other' },
			item: {
				supervision: {
					supervisorConsultantIds: ['me']
				}
			}
		});
		const result = resolve({ session: supervised });
		expect(result).toMatchObject({
			composer: false,
			react: true,
			manageOwn: false,
			readOnlyReason: 'supervisor'
		});
	});

	it('an advice seeker can write in their own conversation', () => {
		expect(
			resolve({
				userId: 'asker',
				viewerIsAdviceSeeker: true,
				session: session({ consultant: { id: 'counsellor' } })
			})
		).toMatchObject({ composer: true, readOnlyReason: null });
	});

	describe('group', () => {
		const group = () => session({ isGroup: true, isSession: false });

		it('writable for a joined consultant', () => {
			expect(resolve({ session: group() }).composer).toBe(true);
		});

		it('read only until joined', () => {
			expect(
				resolve({ session: group(), roomJoined: false })
			).toMatchObject({ ...READ_ONLY, readOnlyReason: 'notJoined' });
		});

		it('an asker without recorded privacy consent is blocked (consent gate)', () => {
			expect(
				resolve({
					session: group(),
					viewerIsAdviceSeeker: true,
					privacyAcceptanceRecorded: false
				})
			).toMatchObject({ ...READ_ONLY, readOnlyReason: 'consentGate' });
		});
	});

	describe('anonymous live chat', () => {
		const anonymous = () =>
			session({
				consultant: { id: 'counsellor' },
				item: { isLive: true }
			});

		it('can reply and react but not edit or delete', () => {
			const result = resolve({
				session: anonymous(),
				userId: 'asker',
				viewerIsAdviceSeeker: true,
				isAnonymousChat: true
			});
			expect(result).toMatchObject({
				composer: true,
				react: true,
				manageOwn: false
			});
		});

		it('is blocked for an asker who has not given privacy consent', () => {
			expect(
				resolve({
					session: anonymous(),
					userId: 'asker',
					viewerIsAdviceSeeker: true,
					isAnonymousChat: true,
					privacyAcceptanceRecorded: false
				})
			).toMatchObject({ ...READ_ONLY, readOnlyReason: 'consentGate' });
		});
	});

	it('a thread keeps reply and react but not edit or delete', () => {
		expect(resolve({ channelKind: 'thread' })).toMatchObject({
			composer: true,
			react: true,
			manageOwn: false
		});
	});
});
