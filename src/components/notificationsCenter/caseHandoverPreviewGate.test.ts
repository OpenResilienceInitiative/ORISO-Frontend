// @vitest-environment jsdom — the module reaches the api layer, which reads
// `window` while resolving the API base URL at import time.
import { describe, expect, it } from 'vitest';
import { requiresCaseHandoverCheck } from './caseHandoverPreviewGate';
import { STATUS_ENQUIRY } from '../../globalState/interfaces';

/**
 * The timeline is the third surface that shows message content: the
 * conversation (curtained by `SessionStream`), the session list (which shows
 * `caseHandover.list.hiddenPreview`) and now the activity card. This predicate
 * decides which cards must clear the handover check before hydrating — so
 * every `false` it returns is a card that decrypts without asking anyone.
 */
const session = (overrides: Record<string, any> = {}) =>
	({
		item: { status: 2 },
		isGroup: false,
		isSession: true,
		isEmptyEnquiry: false,
		consultant: { id: 'other-consultant' },
		...overrides
	}) as any;

describe('requiresCaseHandoverCheck', () => {
	it("checks a colleague's live one-to-one session", () => {
		expect(requiresCaseHandoverCheck(session(), 'me')).toBe(true);
	});

	it('exempts my own session, so it costs no status request', () => {
		expect(
			requiresCaseHandoverCheck(
				session({ consultant: { id: 'me' } }),
				'me'
			)
		).toBe(false);
	});

	it('compares owner ids as strings, since one side may be numeric', () => {
		expect(
			requiresCaseHandoverCheck(session({ consultant: { id: 42 } }), '42')
		).toBe(false);
	});

	it('exempts group chats — handover applies to one-to-one cases', () => {
		expect(
			requiresCaseHandoverCheck(session({ isGroup: true }), 'me')
		).toBe(false);
	});

	it('exempts enquiries, before anyone owns them', () => {
		expect(
			requiresCaseHandoverCheck(
				session({ item: { status: STATUS_ENQUIRY } }),
				'me'
			)
		).toBe(false);
		expect(
			requiresCaseHandoverCheck(session({ isEmptyEnquiry: true }), 'me')
		).toBe(false);
	});

	it('exempts an ownerless session — nobody has a case to hand over', () => {
		expect(
			requiresCaseHandoverCheck(session({ consultant: undefined }), 'me')
		).toBe(false);
	});

	it('checks a session the timeline could not resolve', () => {
		// The hole Shanzae found on PR #1046: `SessionsDataContext` is
		// paginated and fills asynchronously, so a card routinely names a
		// session that is not loaded. Reading "not found" as "not controlled"
		// let exactly those cards decrypt.
		expect(requiresCaseHandoverCheck(null, 'me')).toBe(true);
		expect(requiresCaseHandoverCheck(undefined, 'me')).toBe(true);
		expect(requiresCaseHandoverCheck({} as any, 'me')).toBe(true);
	});
});

describe('requiresCaseHandoverCheck while user data is still loading', () => {
	// Ownership is the only thing `userId` decides, so it is tested last.
	// Checking it first made every group chat and enquiry request a handover
	// status during the window before user data arrived.
	it('still exempts group chats, enquiries and ownerless sessions', () => {
		expect(
			requiresCaseHandoverCheck(session({ isGroup: true }), undefined)
		).toBe(false);
		expect(
			requiresCaseHandoverCheck(
				session({ item: { status: STATUS_ENQUIRY } }),
				undefined
			)
		).toBe(false);
		expect(
			requiresCaseHandoverCheck(
				session({ consultant: undefined }),
				undefined
			)
		).toBe(false);
	});

	it('checks an owned session, because ownership cannot be compared yet', () => {
		expect(requiresCaseHandoverCheck(session(), undefined)).toBe(true);
	});
});
