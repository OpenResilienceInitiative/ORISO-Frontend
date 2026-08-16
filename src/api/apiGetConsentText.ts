import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * ============================================================================
 * CONTRACT — verified against ORISO-AgencyService PR #256
 * (`feat/legal-text-versioning-250`: `api/agencyservice.yaml` and
 * `api/service/legal/ResolvedLegalText.java`), which serves
 * `GET /service/agencies/{agencyId}/topics/{topicId}/legal` as:
 *
 *   { "dpp":     { "content", "consentText", "sourceLevel", "versionId" },
 *     "imprint": { "content", "consentText", "sourceLevel", "versionId" } }
 *
 * Everything this frontend assumes about the wire shape lives in this module
 * and nowhere else, so aligning with the backend never reaches a component.
 *
 * What ADR-021 fixes and this relies on:
 *
 * - decision 4 — the consent sentence is a **field of the data-protection
 *   policy**, hence `dpp.consentText`. Always null on `imprint`, which is an
 *   information duty and never a consent gate (decision 7).
 * - decision 5 — substitution is **split**: `{{Beratungsstelle}}` and
 *   `{{Thema}}` are already substituted server-side; `{{legal_links}}` arrives
 *   **intact**, because the link targets come from this frontend's deployment
 *   configuration and the backend does not know them.
 * - decision 6 — the token dialect is `{{key}}`. Träger-authored text never
 *   passes through Freemarker, so `${...}` must not appear.
 *
 * Two corrections this alignment made, both of which would have failed
 * silently rather than loudly:
 *
 * 1. `versionId` is `integer`/`int64` — a JSON **number**, not a string.
 *    Reading it as a string yielded `null` for every response, which would
 *    have made every consent binding version-blind: a Träger publishing new
 *    wording would not have invalidated an existing acceptance.
 * 2. There is **no `cookieNotice` field**. The schema says so in as many
 *    words: the cookie/authentication notice "is NOT part of this text: it is
 *    a fixed, non-editable addendum the client renders beneath the sentence."
 *    An earlier commit here read one from the payload on the strength of the
 *    prose in sub-issue #254. The client owns that wording; the frontend
 *    catalogue is its source, not a fallback.
 *
 * `sourceLevel` is served and deliberately not read: nothing renders it yet,
 * and a field parsed into a type but never used is exactly how `renderedPrivacy`
 * came to hide a defect in this same flow.
 */

export interface ConsentTextData {
	/**
	 * The resolved consent sentence. Either plain HTML or the JSON
	 * language->HTML map the other legal texts use — the caller resolves it
	 * through `resolveLegalContent`. Server-side placeholders are already
	 * substituted; `{{legal_links}}` is still in it.
	 */
	sentence: string;
	/**
	 * Id of the `legal_text_version` snapshot this wording corresponds to
	 * (ADR-021 decision 4 — one history, not two; the identifier ADR-022
	 * decision 2 pins a recorded consent to). A JSON number on the wire.
	 * `null` for the Träger and platform levels, whose history lives in
	 * ORISO-TenantService rather than in AgencyService.
	 */
	versionId: number | null;
}

const asNonEmptyString = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value : null;

const asVersionId = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Maps the department legal response onto `ConsentTextData`.
 *
 * Exported for tests, and the single place the wire shape is interpreted.
 * Returns `null` whenever no consent sentence is configured — which is the
 * normal case today and must produce exactly the pre-#250 registration.
 */
export const normalizeConsentTextResponse = (
	response: unknown
): ConsentTextData | null => {
	if (!response || typeof response !== 'object') {
		return null;
	}

	const body = response as Record<string, unknown>;
	const dpp =
		body.dpp && typeof body.dpp === 'object'
			? (body.dpp as Record<string, unknown>)
			: null;

	const sentence = asNonEmptyString(dpp?.consentText);
	if (!sentence) {
		return null;
	}

	return {
		sentence,
		versionId: asVersionId(dpp?.versionId)
	};
};

/**
 * Loads the Träger-authored consent sentence for a department (agency x topic).
 * Public endpoint, no auth.
 *
 * Degrades to `null` on every failure — a backend without #250 answers without
 * the field, an older one 404s, and the network can be down. In all three
 * cases the caller renders today's static sentence, so an unconfigured or
 * unreachable backend can never leave the consent checkbox unlabelled.
 */
export const apiGetConsentText = async (
	agencyId: number,
	topicId: number,
	signal?: AbortSignal
): Promise<ConsentTextData | null> =>
	fetchData({
		url: endpoints.agencyDepartmentLegal(agencyId, topicId),
		method: FETCH_METHODS.GET,
		skipAuth: true,
		// NO_MATCH + CATCH_ALL keep fetchData from redirecting to the error
		// page — any non-2xx simply rejects and is mapped to null here.
		responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.CATCH_ALL],
		...(signal ? { signal } : {})
	})
		.then(normalizeConsentTextResponse)
		.catch(() => null);
