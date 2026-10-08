import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export interface DepartmentLegalContent {
	/**
	 * Published multilingual content as a JSON language->HTML map string.
	 * Null when the text is a draft or was never authored.
	 */
	content: string | null;
	/**
	 * Optional multilingual consent sentence (JSON language->text/HTML map),
	 * e.g. `{"de":"Ich habe die … gelesen."}`. Null/absent when unset.
	 */
	consentText?: string | null;
	/**
	 * Id of the `legal_text_version` snapshot this text corresponds to
	 * (ADR-021 decision 4). JSON number on the wire; `null` for the Träger
	 * and platform levels whose history lives in ORISO-TenantService.
	 * Preserved on the normalized shape so consent bindings recorded through
	 * `apiGetConsentText` stay version-aware (ORISO-Frontend#1182).
	 */
	versionId?: number | null;
}

export interface DepartmentLegalData {
	dpp: DepartmentLegalContent;
	imprint: DepartmentLegalContent;
}

/**
 * Discriminated outcome of a single department-legal fetch. Preserves the
 * distinction that `apiGetConsentText` depends on: `ok + null` means "the
 * record does not exist" (404, or a backend without the endpoint), whereas
 * `unavailable` means "we could not read it" (5xx, network). Collapsing them
 * would let a dropped request enable acceptance of the platform sentence for
 * a department whose own wording is the one in force — see the fail-closed
 * rationale in `apiGetConsentText`.
 */
export type DepartmentLegalOutcome =
	| { status: 'ok'; data: DepartmentLegalData | null }
	| { status: 'unavailable' };

const asNullableString = (value: unknown): string | null =>
	typeof value === 'string' ? value : null;

const asVersionId = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Keeps only the public legal fields we render. Ensures `consentText` is
 * always present on the typed object (null when the backend omits it) and
 * carries `versionId` through so the consent binding can pin the exact
 * wording that was accepted.
 */
export const normalizeDepartmentLegalResponse = (
	response: unknown
): DepartmentLegalData | null => {
	if (!response || typeof response !== 'object') {
		return null;
	}

	const body = response as Record<string, unknown>;
	const mapContent = (raw: unknown): DepartmentLegalContent => {
		if (!raw || typeof raw !== 'object') {
			return { content: null, consentText: null };
		}
		const entry = raw as Record<string, unknown>;
		const versionId = asVersionId(entry.versionId);
		// Only include versionId when present so existing consumers whose
		// shape assertions predate ORISO-Frontend#1182 keep matching.
		return versionId != null
			? {
					content: asNullableString(entry.content),
					consentText: asNullableString(entry.consentText),
					versionId
				}
			: {
					content: asNullableString(entry.content),
					consentText: asNullableString(entry.consentText)
				};
	};

	return {
		dpp: mapContent(body.dpp),
		imprint: mapContent(body.imprint)
	};
};

const fetchDepartmentLegalOutcome = async (
	agencyId: number,
	topicId: number,
	signal?: AbortSignal
): Promise<DepartmentLegalOutcome> =>
	fetchData({
		url: endpoints.agencyDepartmentLegal(agencyId, topicId),
		method: FETCH_METHODS.GET,
		skipAuth: true,
		// NO_MATCH + CATCH_ALL keep fetchData from redirecting to the error
		// page - any non-2xx simply rejects and is mapped here.
		responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.CATCH_ALL],
		...(signal ? { signal } : {})
	})
		.then(
			(response) =>
				({
					status: 'ok',
					data: normalizeDepartmentLegalResponse(response)
				}) as DepartmentLegalOutcome
		)
		.catch((error: Error) =>
			error?.message === FETCH_ERRORS.NO_MATCH
				? ({ status: 'ok', data: null } as DepartmentLegalOutcome)
				: ({ status: 'unavailable' } as DepartmentLegalOutcome)
		);

/**
 * Loads the published legal texts (data privacy policy + imprint) of a
 * department (agency x topic). Public endpoint, no auth.
 *
 * Degrades gracefully: resolves to null when the endpoint does not exist
 * yet (backend without AgencyService #90 answers 404), the department is
 * unknown, or the request fails - callers then fall back to tenant-level
 * content, i.e. today's behavior.
 *
 * Callers that need to distinguish "no record" from "unreadable" (the
 * consent-sentence path — see `apiGetConsentText`) go through
 * `getCachedDepartmentLegalOutcome` instead.
 */
export const apiGetDepartmentLegal = async (
	agencyId: number,
	topicId: number,
	signal?: AbortSignal
): Promise<DepartmentLegalData | null> => {
	const outcome = await fetchDepartmentLegalOutcome(
		agencyId,
		topicId,
		signal
	);
	return outcome.status === 'ok' ? outcome.data : null;
};

/**
 * In-flight / settled department-legal promises, keyed by agencyId:topicId.
 * Cached as `DepartmentLegalOutcome` so both consumers — the legal panel and
 * the consent sentence (ORISO-Frontend#1182) — resolve the same snapshot and
 * every non-2xx keeps its exact category.
 */
const departmentLegalCache = new Map<string, Promise<DepartmentLegalOutcome>>();

const departmentLegalCacheKey = (agencyId: number, topicId: number): string =>
	`${agencyId}:${topicId}`;

/**
 * Shared loader for department legal — discriminated variant. Does not accept
 * AbortSignal — aborting would cancel work for every consumer of the same key.
 */
export const getCachedDepartmentLegalOutcome = (
	agencyId: number,
	topicId: number
): Promise<DepartmentLegalOutcome> => {
	const key = departmentLegalCacheKey(agencyId, topicId);
	if (!departmentLegalCache.has(key)) {
		departmentLegalCache.set(
			key,
			fetchDepartmentLegalOutcome(agencyId, topicId).then((outcome) => {
				if (outcome.status === 'unavailable') {
					departmentLegalCache.delete(key);
				}
				return outcome;
			})
		);
	}
	return departmentLegalCache.get(key)!;
};

/**
 * Shared loader that collapses unavailability to null — the shape existing
 * consumers (`useDepartmentLegal`, the legal panel) already handle. New
 * callers that need the fail-closed distinction should use
 * `getCachedDepartmentLegalOutcome`.
 */
export const getCachedDepartmentLegal = async (
	agencyId: number,
	topicId: number
): Promise<DepartmentLegalData | null> => {
	const outcome = await getCachedDepartmentLegalOutcome(agencyId, topicId);
	return outcome.status === 'ok' ? outcome.data : null;
};

/** Clear one key or the whole cache (tests / invalidation). */
export const clearDepartmentLegalCache = (
	agencyId?: number,
	topicId?: number
): void => {
	if (agencyId != null && topicId != null) {
		departmentLegalCache.delete(departmentLegalCacheKey(agencyId, topicId));
		return;
	}
	departmentLegalCache.clear();
};
