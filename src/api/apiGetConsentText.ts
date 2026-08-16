import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * ============================================================================
 * CONTRACT — ALIGNMENT PENDING (EPIC ORISO-AgencyService#250)
 * ============================================================================
 *
 * Everything this frontend assumes about the *wire shape* of the consent
 * sentence lives in this module and nowhere else. When the AgencyService PR
 * lands, only `normalizeConsentTextResponse` below should need editing — no
 * component, no test of a component, no i18n catalogue.
 *
 * What ADR-021 fixes, and what this module therefore relies on:
 *
 * - decision 4 — the consent sentence is a **field of the data-protection
 *   policy**, not a legal-text kind of its own. It is consequently expected on
 *   the department's existing public legal endpoint
 *   (`/service/agencies/{aid}/topics/{tid}/legal`, `endpoints.agencyDepartmentLegal`)
 *   next to `dpp` and `imprint`, and it shares the DPP's version pointer.
 * - decision 5 — placeholder substitution is **split**: the server has already
 *   substituted `{{Beratungsstelle}}`, `{{Thema}}` and any contact data;
 *   `{{legal_links}}` arrives **intact**, because the link targets come from
 *   this frontend's deployment configuration (`LegalLinksProvider`) and the
 *   backend does not know them.
 * - decision 6 — the token dialect is `{{key}}`. Träger-authored text never
 *   passes through Freemarker, so `${...}` must not appear.
 *
 * TODO(ORISO-AgencyService#250): verify against the AgencyService PR and drop
 * this block once confirmed:
 *   1. field name and nesting — `dpp.consentText` vs. a sibling `consentText`
 *      vs. a dedicated endpoint;
 *   2. whether the sentence is a bare HTML string or the same
 *      language->HTML map the other legal texts use (both are handled — see
 *      `resolveLegalContent` at the call site);
 *   3. the version-pointer field name (`dpp.versionId` here), which ADR-022
 *      decision 2 will persist as `session.consented_legal_version_id`.
 * Until it lands, a backend that knows nothing about any of this simply omits
 * the field and the registration falls back to today's static sentence.
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
	 * Version of the data-protection policy this sentence belongs to
	 * (ADR-021 decision 4 — one history, not two). `null` on backends that do
	 * not carry the version history yet.
	 */
	versionId: string | null;
}

const asNonEmptyString = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value : null;

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

	const sentence =
		asNonEmptyString(dpp?.consentText) ??
		asNonEmptyString(body.consentText);
	if (!sentence) {
		return null;
	}

	return {
		sentence,
		versionId:
			asNonEmptyString(dpp?.versionId) ?? asNonEmptyString(body.versionId)
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
