import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { SessionSupervisor } from './apiGetSessionSupervisors';

export interface AddSupervisorRequest {
	supervisorConsultantId: string;
}

export const apiAddSessionSupervisor = async (
	sessionId: number,
	supervisorConsultantId: string
): Promise<SessionSupervisor> => {
	const url = `${endpoints.sessionBase}/${sessionId}/supervisors`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			supervisorConsultantId
		}),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});
};

