import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Placeholder for a deleted advice-seeker chat (ORISO-Frontend#1159). The
 * backend stores no personal data for it: only the id the session had, its
 * counselling centre and when it was deleted.
 */
export interface DeletedAskerSession {
	formerSessionId: number;
	agencyId?: number;
	deletedAt: string;
}

const isDeletedAskerSession = (
	value: unknown
): value is DeletedAskerSession => {
	if (!value || typeof value !== 'object') return false;
	const data = value as Record<string, unknown>;
	return (
		typeof data.formerSessionId === 'number' &&
		typeof data.deletedAt === 'string' &&
		Number.isFinite(Date.parse(data.deletedAt))
	);
};

/**
 * The calling counsellor's placeholders from the last 30 days. Best-effort:
 * the conversation list must keep working when this call fails, so every
 * failure reads as "no placeholders".
 */
export const apiGetDeletedAskerSessions = async (
	signal?: AbortSignal
): Promise<DeletedAskerSession[]> => {
	let response: unknown;
	try {
		response = await fetchData({
			url: endpoints.consultantDeletedAskerSessions,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL],
			...(signal ? { signal } : {})
		});
	} catch {
		return [];
	}
	return Array.isArray(response)
		? response.filter(isDeletedAskerSession)
		: [];
};
