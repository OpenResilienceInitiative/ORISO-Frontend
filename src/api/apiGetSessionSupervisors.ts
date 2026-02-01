import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

export interface SessionSupervisor {
	id: number;
	sessionId: number;
	supervisorConsultantId: string;
	supervisorUsername: string;
	addedByConsultantId: string;
	addedDate: string;
	matrixRoomId?: string;
}

export const apiGetSessionSupervisors = async (
	sessionId: number
): Promise<SessionSupervisor[]> => {
	const url = `${endpoints.sessionBase}/${sessionId}/supervisors`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});
};

