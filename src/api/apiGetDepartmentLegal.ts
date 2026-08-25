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
}

export interface DepartmentLegalData {
	dpp: DepartmentLegalContent;
	imprint: DepartmentLegalContent;
}

const asNullableString = (value: unknown): string | null =>
	typeof value === 'string' ? value : null;

/**
 * Keeps only the public legal fields we render. Ensures `consentText` is
 * always present on the typed object (null when the backend omits it).
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
		return {
			content: asNullableString(entry.content),
			consentText: asNullableString(entry.consentText)
		};
	};

	return {
		dpp: mapContent(body.dpp),
		imprint: mapContent(body.imprint)
	};
};

/**
 * Loads the published legal texts (data privacy policy + imprint) of a
 * department (agency x topic). Public endpoint, no auth.
 *
 * Degrades gracefully: resolves to null when the endpoint does not exist
 * yet (backend without AgencyService #90 answers 404), the department is
 * unknown, or the request fails - callers then fall back to tenant-level
 * content, i.e. today's behavior.
 */
export const apiGetDepartmentLegal = async (
	agencyId: number,
	topicId: number,
	signal?: AbortSignal
): Promise<DepartmentLegalData | null> =>
	fetchData({
		url: endpoints.agencyDepartmentLegal(agencyId, topicId),
		method: FETCH_METHODS.GET,
		skipAuth: true,
		// NO_MATCH + CATCH_ALL keep fetchData from redirecting to the error
		// page - any non-2xx simply rejects and is mapped to null here.
		responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.CATCH_ALL],
		...(signal ? { signal } : {})
	})
		.then(normalizeDepartmentLegalResponse)
		.catch(() => null);
