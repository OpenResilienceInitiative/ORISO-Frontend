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
 * The outcome of asking for a department's consent sentence.
 *
 * `ok` with a null `consentText` and `unavailable` are deliberately different
 * answers, because they mean opposite things for a Fachbereich the backend has
 * already told us carries a published policy:
 *
 * - `ok` + null — the backend answered, and there is no Träger sentence. The
 *   platform wording applies, and accepting it is correct.
 * - `unavailable` — we do not know what applies. Collapsing this into the
 *   first would let a dropped request enable acceptance of the platform
 *   sentence for a department whose own wording is the one in force: the user
 *   agrees to a text that does not govern them. The consent gate therefore
 *   fails **closed** — "we could not load it" must never degrade into "the
 *   platform text applies".
 */
export type ConsentTextResult =
	| { status: 'ok'; consentText: ConsentTextData | null }
	| { status: 'unavailable' };

/**
 * Loads the Träger-authored consent sentence for a department (agency x topic).
 * Public endpoint, no auth.
 *
 * A backend that predates this epic answers 200 without the field, which is an
 * honest `ok` + null and yields today's static sentence.
 *
 * **404 is `ok` + null, not `unavailable`.** There is no such legal record —
 * either the department has none or the backend has no such endpoint — so no
 * department-specific wording governs and the platform sentence is the one in
 * force. That is the legacy behaviour, and it collects agreement to wording
 * that genuinely applies.
 *
 * This used to be covered by not requesting at all for a department reporting
 * no policy, but that predicate was removed: it also skipped departments that
 * *inherit* Träger wording (ORISO-Frontend#1110). Without this distinction a
 * frontend paired with an older backend would 404 on every selection, resolve
 * `unavailable`, and disable the checkbox for everyone — blocking registration
 * outright rather than falling back.
 *
 * What still reaches `unavailable` is the case that matters: a record that may
 * well exist and could not be read — a 5xx, a network failure — where offering
 * the platform sentence would collect agreement to the wrong document. Fail
 * closed there, and only there.
 */
export const apiGetConsentText = async (
	agencyId: number,
	topicId: number,
	signal?: AbortSignal
): Promise<ConsentTextResult> =>
	fetchData({
		url: endpoints.agencyDepartmentLegal(agencyId, topicId),
		method: FETCH_METHODS.GET,
		skipAuth: true,
		// NO_MATCH + CATCH_ALL keep fetchData from redirecting to the error
		// page — any non-2xx simply rejects and is mapped to null here.
		responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.CATCH_ALL],
		...(signal ? { signal } : {})
	})
		.then((response) => ({
			status: 'ok' as const,
			consentText: normalizeConsentTextResponse(response)
		}))
		.catch((error: Error) =>
			error?.message === FETCH_ERRORS.NO_MATCH
				? { status: 'ok' as const, consentText: null }
				: { status: 'unavailable' as const }
		);
