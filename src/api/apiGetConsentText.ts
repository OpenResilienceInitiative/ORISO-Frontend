import {
	DepartmentLegalData,
	getCachedDepartmentLegalOutcome,
	normalizeDepartmentLegalResponse
} from './apiGetDepartmentLegal';

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
 * Everything this frontend assumes about the wire shape lives in
 * `apiGetDepartmentLegal.normalizeDepartmentLegalResponse` and here, so
 * aligning with the backend never reaches a component.
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
 *
 * ORISO-Frontend#1182: this function now reads from the shared
 * department-legal cache (`getCachedDepartmentLegalOutcome`) so
 * `DataProtectionConsentLabel` and `DepartmentLegalSection` on the same
 * registration screen no longer issue two independent requests and cannot
 * disagree on the snapshot. The fail-closed distinction (`ok + null` vs
 * `unavailable`) is preserved end-to-end by the discriminated cache outcome.
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

/**
 * Derives the consent sentence from an already-normalized department-legal
 * payload. Returns `null` whenever no sentence is configured — the normal
 * case today, which must render exactly the pre-#250 registration.
 *
 * Kept as a pure function so the wire shape is interpreted in exactly one
 * place: `apiGetDepartmentLegal.normalizeDepartmentLegalResponse` maps the
 * response, and this reads the consent sentence off that typed object.
 */
export const deriveConsentText = (
	data: DepartmentLegalData | null
): ConsentTextData | null => {
	const sentenceRaw = data?.dpp?.consentText;
	if (typeof sentenceRaw !== 'string' || sentenceRaw.trim() === '') {
		return null;
	}
	return {
		sentence: sentenceRaw,
		versionId:
			typeof data?.dpp?.versionId === 'number' &&
			Number.isFinite(data.dpp.versionId)
				? data.dpp.versionId
				: null
	};
};

/**
 * Facade over `deriveConsentText(normalizeDepartmentLegalResponse(...))`.
 * Kept as a single entry point so tests pinning the wire shape do not have to
 * chain both helpers, and so any future change to the underlying pipeline
 * cannot silently drift the consent-sentence contract from the payload the
 * shared cache stores.
 */
export const normalizeConsentTextResponse = (
	response: unknown
): ConsentTextData | null =>
	deriveConsentText(normalizeDepartmentLegalResponse(response));

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
 * Public endpoint, no auth. Backed by the shared department-legal cache so a
 * co-mounted `DepartmentLegalSection` does not fire a second request against
 * the same URL (ORISO-Frontend#1182).
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
 *
 * `signal` is accepted for source compatibility with earlier callers but has
 * no effect: the underlying request is shared across all consumers of the same
 * key, and aborting would cancel work for the co-mounted panel too.
 */
export const apiGetConsentText = async (
	agencyId: number,
	topicId: number,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_signal?: AbortSignal
): Promise<ConsentTextResult> => {
	const outcome = await getCachedDepartmentLegalOutcome(agencyId, topicId);
	if (outcome.status === 'unavailable') {
		return { status: 'unavailable' };
	}
	return {
		status: 'ok',
		consentText: deriveConsentText(outcome.data)
	};
};
