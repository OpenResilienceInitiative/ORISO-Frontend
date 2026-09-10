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
 * - **Department known, answer definitive.** Its own wording governs when it has one; when it has
 *   none (`ok` with a null sentence — including a 404, where no such legal record exists) the
 *   platform sentence is genuinely the text in force.
 * - **Department known, answer unavailable.** A 5xx or a network failure: we do not know what
 *   applies. Offering the platform sentence here would collect agreement to the wrong document, so
 *   the consent is held back and the caller retries. Fail closed, and only here — the distinction
 *   between this and "has none" is the whole point of `apiGetConsentText`'s discriminated result.
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
	 * Whether the sentence on screen is the one that governs this person. False only in the
	 * unavailable case; the caller holds the consent back while it is false.
	 */
	readable: boolean;
}

export const resolveEntryRoomConsent = ({
	hasDepartment,
	department,
	platformHtml,
	legalLinksHtml,
	locale
}: EntryRoomConsentInput): EntryRoomConsent => {
	const readable = !hasDepartment || department.status !== 'unavailable';

	if (department.status !== 'ok' || !department.sentence) {
		return { html: platformHtml, versionId: null, readable };
	}

	/* The wording may be a language map rather than plain HTML; the same resolver the other legal
	   texts use picks the reader's language and falls back within the map. */
	const resolved = resolveLegalContent(department.sentence, locale);

	return {
		html: substituteLegalLinks(
			resolved?.html ?? department.sentence,
			legalLinksHtml
		),
		versionId: department.versionId,
		readable
	};
};
