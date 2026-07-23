import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export const apiPutSessionData = async (
	sessionId: number,
	data: Record<string, unknown>
): Promise<any> => {
	const url = `${endpoints.sessionBase}/${sessionId}/data`;

	return fetchData({
		url,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify(data),
		rcValidation: true
	});
};
