// @vitest-environment jsdom — the module reaches the api layer, which reads
// `window` while resolving the API base URL at import time.
import { describe, expect, it } from 'vitest';
import { isTimelineCaseHandoverControlled } from './caseHandoverPreviewGate';
import { STATUS_ENQUIRY } from '../../globalState/interfaces';

/**
 * The timeline is the third surface that shows message content: the
 * conversation (curtained by `SessionStream`), the session list (which shows
 * `caseHandover.list.hiddenPreview`) and now the activity card. This predicate
 * decides which sessions have to pass the handover check before a card may
 * hydrate its preview — everything it lets through previews without a request.
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

describe('isTimelineCaseHandoverControlled', () => {
	it("controls a colleague's live one-to-one session", () => {
		expect(isTimelineCaseHandoverControlled(session(), 'me')).toBe(true);
	});

	it('leaves my own session alone, so it costs no status request', () => {
		expect(
			isTimelineCaseHandoverControlled(
				session({ consultant: { id: 'me' } }),
				'me'
			)
		).toBe(false);
	});

	it('compares owner ids as strings, since one side may be numeric', () => {
		expect(
			isTimelineCaseHandoverControlled(
				session({ consultant: { id: 42 } }),
				'42'
			)
		).toBe(false);
	});

	it('leaves group chats alone — handover applies to one-to-one cases', () => {
		expect(
			isTimelineCaseHandoverControlled(session({ isGroup: true }), 'me')
		).toBe(false);
	});

	it('leaves enquiries alone, before anyone owns them', () => {
		expect(
			isTimelineCaseHandoverControlled(
				session({ item: { status: STATUS_ENQUIRY } }),
				'me'
			)
		).toBe(false);
		expect(
			isTimelineCaseHandoverControlled(
				session({ isEmptyEnquiry: true }),
				'me'
			)
		).toBe(false);
	});

	it('treats an ownerless session as uncontrolled', () => {
		expect(
			isTimelineCaseHandoverControlled(
				session({ consultant: undefined }),
				'me'
			)
		).toBe(false);
	});

	it('answers false without a session or without a user', () => {
		expect(isTimelineCaseHandoverControlled(null, 'me')).toBe(false);
		expect(isTimelineCaseHandoverControlled(session(), undefined)).toBe(
			false
		);
	});
});
