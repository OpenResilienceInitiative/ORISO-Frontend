import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { SessionSupervisor } from './apiGetSessionSupervisors';

/**
 * ORISO-Frontend#2494 *6: replace one supervisor by another in one server
 * step. The server keeps the supervision side room, posts one notice into it
 * and records one swap in the Admin log; the advice seeker is told only when
 * `notifyClient` is true.
 */
export const apiReplaceSessionSupervisor = async (
	sessionId: number,
	supervisorId: number,
	supervisorConsultantId: string,
	notes: string | undefined,
	notifyClient: boolean
): Promise<SessionSupervisor> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/supervisors/${supervisorId}`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({
			supervisorConsultantId,
			notes: notes || null,
			notifyClient
		}),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});
