import { describe, expect, it } from 'vitest';
import {
	requiresAnonymousInquiryConsent,
	shouldBlockAnonymousInquiryChat
} from './anonymousConsentInvariant';
import {
	STATUS_ARCHIVED,
	STATUS_EMPTY,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';

/**
 * ORISO-UserService#927 — the regression test that pins the flow invariant.
 *
 * The consent promise in `AnonymousConsentGate` ("only after that may we start a
 * chat with you") is true today, but it is true **because of the flow**, not
 * because of an explicit check: the gate is active exactly while the session is
 * in the pre-assignment enquiry phase, so nothing has been sent and nobody has
 * picked the case up. Nothing asserted that. Someone changing the status
 * condition, or letting the composer render during the enquiry phase, would
 * remove the protection without a single test turning red.
 *
 * These are that test. This is the consent step for special-category data under
 * §11 KDG; the guarantee deserves to be asserted rather than emergent.
 */

const anonymousAsker = {
	isAnonymousAskerExperience: true,
	sessionStatus: STATUS_ENQUIRY,
	dataPrivacyConfirmation: null as string | null
};

describe('requiresAnonymousInquiryConsent — the flow invariant', () => {
	it('requires consent for an anonymous asker in the empty/enquiry phase', () => {
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				sessionStatus: STATUS_EMPTY
			})
		).toBe(true);
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				sessionStatus: STATUS_ENQUIRY
			})
		).toBe(true);
	});

	it('accepts the status as a string, the shape the API actually returns', () => {
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				sessionStatus: String(STATUS_ENQUIRY)
			})
		).toBe(true);
	});

	it('stops requiring consent once it has been recorded', () => {
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				dataPrivacyConfirmation: '2026-08-07T10:00:00Z'
			})
		).toBe(false);
	});

	it('treats a blank confirmation as no confirmation', () => {
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				dataPrivacyConfirmation: '   '
			})
		).toBe(true);
	});

	it('does not apply outside the anonymous asker experience', () => {
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				isAnonymousAskerExperience: false
			})
		).toBe(false);
	});

	it('does not apply once the case has left the enquiry phase', () => {
		expect(
			requiresAnonymousInquiryConsent({
				...anonymousAsker,
				sessionStatus: STATUS_ARCHIVED
			})
		).toBe(false);
	});
});

describe('shouldBlockAnonymousInquiryChat — the composer lock', () => {
	it('blocks the composer while consent is required and not yet given', () => {
		expect(
			shouldBlockAnonymousInquiryChat({
				...anonymousAsker,
				consentAcceptedInSession: false,
				requiresPseudonymConfirmation: false,
				isInAnonymousWaitingQueuePhase: false
			})
		).toBe(true);
	});

	it('is exactly the invariant the consent copy promises: no consent, no composer', () => {
		/* If this ever returns false for an unconsented anonymous enquiry, the
		   sentence "only after that may we start a chat with you" becomes a
		   false statement in the one document meant to be the §11 KDG
		   transparency record. */
		[STATUS_EMPTY, STATUS_ENQUIRY].forEach((sessionStatus) => {
			expect(
				shouldBlockAnonymousInquiryChat({
					isAnonymousAskerExperience: true,
					sessionStatus,
					dataPrivacyConfirmation: null,
					consentAcceptedInSession: false,
					requiresPseudonymConfirmation: false,
					isInAnonymousWaitingQueuePhase: false
				})
			).toBe(true);
		});
	});

	it('releases the composer once consent was accepted in this session', () => {
		expect(
			shouldBlockAnonymousInquiryChat({
				...anonymousAsker,
				consentAcceptedInSession: true,
				requiresPseudonymConfirmation: false,
				isInAnonymousWaitingQueuePhase: false
			})
		).toBe(false);
	});

	it('keeps blocking while the pseudonym still has to be confirmed', () => {
		expect(
			shouldBlockAnonymousInquiryChat({
				...anonymousAsker,
				dataPrivacyConfirmation: '2026-08-07T10:00:00Z',
				consentAcceptedInSession: true,
				requiresPseudonymConfirmation: true,
				isInAnonymousWaitingQueuePhase: false
			})
		).toBe(true);
	});

	it('does not block a registered Agency Counselling session', () => {
		// Consent is given at registration there, per the topic-before-consent
		// invariant in ADR-014 — the in-chat gate must not fire a second time.
		expect(
			shouldBlockAnonymousInquiryChat({
				isAnonymousAskerExperience: false,
				sessionStatus: STATUS_ENQUIRY,
				dataPrivacyConfirmation: null,
				consentAcceptedInSession: false,
				requiresPseudonymConfirmation: false,
				isInAnonymousWaitingQueuePhase: false
			})
		).toBe(false);
	});
});
