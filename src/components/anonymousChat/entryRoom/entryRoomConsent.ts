import { substituteLegalLinks } from '../../../utils/consentText';
import { resolveLegalContent } from '../../../utils/legalContent';

/**
 * Which consent sentence the live-chat entry room shows, as one pure decision.
 *
 * Extracted from `LiveChatEntryRoom` for the same reason `anonymousConsentInvariant.ts` was
 * extracted from `SessionItemComponent`: the rule decides which legal document a person is asked
 * to agree to, and every way of getting it wrong renders perfectly. A sentence is a sentence on
 * screen — nothing about the platform fallback looks different from a Träger's own wording, so a
 * defect here is invisible in review and invisible in QA. It is asserted instead.
 *
 * The rule, in three cases:
 *
 * - **No department known.** The enquiry carries no agency, or the backend predates
 *   ORISO-UserService#1141 and does not send the coordinate. The platform sentence is what has
 *   always applied here and still does. Nothing is held back.
 * - **Department known, own wording available.** Its published wording is shown and its version is
 *   pinned when the customer continues.
 * - **Department known, wording absent or unreadable.** The flow remains available. A fixed system
 *   warning says that no agency policy is currently available and that continuing is at the
 *   customer's own risk. The legal links and cookie disclosure remain part of the checkbox text.
 *   "Unreadable" includes a payload that parses but carries no renderable language: printing the
 *   raw JSON and pinning a version to it would be worse than saying nothing is there.
 * - **Department known, lookup still in flight.** Same warning text, but `readable` is false so the
 *   caller holds the hand-off. Only this case blocks, and only for the duration of one request.
 */
export type DepartmentConsentState =
	| { status: 'idle' }
	| { status: 'ok'; sentence: string | null; versionId: number | null }
	| { status: 'unavailable' };

export interface EntryRoomConsentInput {
	/** Whether the enquiry's (agencyId, topicId) coordinate is known at all. */
	hasDepartment: boolean;
	department: DepartmentConsentState;
	/** The platform sentence, legal links already interpolated. */
	platformHtml: string;
	/** Fixed non-blocking warning used when the agency policy is absent or cannot be read. */
	missingPolicyHtml: string;
	/** Rendered `{{legal_links}}` markup; the backend cannot produce it (ADR-021 decision 5). */
	legalLinksHtml: string;
	/** Reader's language, for a sentence served as a language map rather than plain HTML. */
	locale: string;
}

export interface EntryRoomConsent {
	/** The sentence to render. Never empty — the platform text is the floor. */
	html: string;
	/**
	 * The legal-text version to pin the agreement to (ADR-022 decision 2), or null when there is
	 * nothing to pin: Träger and platform wording lives in TenantService and carries no version.
	 */
	versionId: number | null;
	/**
	 * Whether the sentence on screen is a settled answer about this department.
	 *
	 * False in exactly one case: the lookup has not come back yet. It is never false for a
	 * *failed* lookup — the warning-only product decision holds, and an unavailable agency policy
	 * may not block the conversation. The distinction matters because the two look identical on
	 * screen but are not: "we have not asked yet" must not be shown as "this centre has none", and
	 * must not let the hand-off record a consent that pins no version.
	 */
	readable: boolean;
}

export const resolveEntryRoomConsent = ({
	hasDepartment,
	department,
	platformHtml,
	missingPolicyHtml,
	legalLinksHtml,
	locale
}: EntryRoomConsentInput): EntryRoomConsent => {
	if (!hasDepartment) {
		return { html: platformHtml, versionId: null, readable: true };
	}

	if (department.status === 'idle') {
		/* The answer is still in flight. Saying "no policy is available" here would be a
		   statement about the centre, not about our own request, and accepting on it skips a
		   configured policy: nothing would be pinned because there is no version yet. Hold
		   presentation for the one request instead. This is not the `unavailable` case and does
		   not weaken the warning-only rule — a failed lookup below still never blocks. */
		return { html: missingPolicyHtml, versionId: null, readable: false };
	}

	if (department.status !== 'ok' || !department.sentence) {
		return { html: missingPolicyHtml, versionId: null, readable: true };
	}

	/* The wording may be a language map rather than plain HTML; the same resolver the other legal
	   texts use picks the reader's language and falls back within the map. */
	const resolved = resolveLegalContent(department.sentence, locale);
	if (!resolved) {
		/* A map that parsed but carries no renderable language — `{"de": ""}`, or metadata only.
		   Falling back to the raw string would print the JSON itself as the declaration and pin
		   the agreement to that version: the person would tick a box against a payload nobody can
		   read. An unreadable policy is a missing one. */
		return { html: missingPolicyHtml, versionId: null, readable: true };
	}

	return {
		html: substituteLegalLinks(resolved.html, legalLinksHtml),
		versionId: department.versionId,
		readable: true
	};
};
