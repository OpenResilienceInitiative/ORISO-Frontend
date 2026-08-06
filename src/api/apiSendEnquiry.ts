import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';
import { buildEncryptedEnquiryFinalizationPayload } from './encryptedEnquiryPayload';

export const apiSendEnquiry = async (
	sessionId: number,
	matrixEventId: string,
	language?: string
): Promise<any> => {
	const url = `${endpoints.sessionBase}/${sessionId}/enquiry/new`;
	const data = buildEncryptedEnquiryFinalizationPayload(
		matrixEventId,
		language
	);

	const message = JSON.stringify(data);

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		bodyData: message,
		responseHandling: [FETCH_SUCCESS.CONTENT]
	});
};
