import {
	STATUS_EMPTY,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';

/**
 * The **Eingabesperre** (forward lock) as two pure predicates — extracted from
 * `SessionItemComponent` so it can be asserted rather than merely observed.
 *
 * Why it matters (ORISO-UserService#927, ADR-018 §9): the consent gate promises
 * that nobody starts a chat before consent is confirmed, and that promise
 * currently holds **because of the flow**, not because of an explicit check. The
 * gate is active exactly while the session is in the pre-assignment enquiry
 * phase, so nothing has been sent and no counsellor is in the conversation.
 * Nothing pinned that. Changing the status condition, or letting the composer
 * render during the enquiry phase, would silently remove the protection on the
 * consent step for special-category data under §11 KDG.
 *
 * Scope, deliberately: **anonymous entry paths only.** In Agency Counselling
 * consent is given at registration per the topic-before-consent invariant of
 * ADR-014, and `CreateUserFacade` clears the flag for anonymous registrations
 * precisely so the in-chat gate fires there and only there.
 *
 * Forward lock only. Nothing here may ever delay case assignment or a
 * counsellor's reply — e-mail, 2FA and credential saving are voluntary
 * throughout (the **Zuweisungssperre** deliberately does not exist).
 */

export interface AnonymousConsentContext {
	/** Anonymous asker in their own session — not a counsellor, not registered. */
	isAnonymousAskerExperience: boolean;
	/** `activeSession.item.status`; the API returns it as a number or a string. */
	sessionStatus: number | string | null | undefined;
	/** `userData.dataPrivacyConfirmation` — a timestamp once recorded. */
	dataPrivacyConfirmation: string | null | undefined;
}

export interface AnonymousChatLockContext extends AnonymousConsentContext {
	/** Accepted in this browser session, before `userData` has caught up. */
	consentAcceptedInSession: boolean;
	requiresPseudonymConfirmation: boolean;
	isInAnonymousWaitingQueuePhase: boolean;
}

/** The pre-assignment phase: written, but nobody has picked the case up. */
const isEnquiryPhase = (
	status: number | string | null | undefined
): boolean => {
	if (status === null || status === undefined || status === '') return false;
	const value = Number(status);
	return value === STATUS_EMPTY || value === STATUS_ENQUIRY;
};

/**
 * `dataPrivacyConfirmation` is a timestamp string once recorded. A blank or
 * whitespace-only value is treated as absent — an empty string is what an
 * un-set column serialises to, and reading it as consent would be the exact
 * failure this module exists to prevent.
 */
const isPrivacyAcceptanceRecorded = (
	dataPrivacyConfirmation: string | null | undefined
): boolean => Boolean(dataPrivacyConfirmation?.trim());

export const requiresAnonymousInquiryConsent = ({
	isAnonymousAskerExperience,
	sessionStatus,
	dataPrivacyConfirmation
}: AnonymousConsentContext): boolean =>
	Boolean(isAnonymousAskerExperience) &&
	isEnquiryPhase(sessionStatus) &&
	!isPrivacyAcceptanceRecorded(dataPrivacyConfirmation);

export const shouldShowAnonymousConsentGate = (
	context: AnonymousChatLockContext
): boolean =>
	requiresAnonymousInquiryConsent(context) &&
	!context.consentAcceptedInSession;

/**
 * Whether the composer stays hidden. Consent first, then the pseudonym — the
 * order is not interchangeable: the pseudonym gate is about identity, the
 * consent gate is about whether anything may be transmitted at all.
 */
export const shouldBlockAnonymousInquiryChat = (
	context: AnonymousChatLockContext
): boolean =>
	shouldShowAnonymousConsentGate(context) ||
	(!shouldShowAnonymousConsentGate(context) &&
		(context.requiresPseudonymConfirmation ||
			context.isInAnonymousWaitingQueuePhase));
