import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

/**
 * The ORISO userservice spec no longer exposes PatchConsultantDTO; the PATCH
 * endpoint still accepts this shape, so it is typed locally.
 */
export type PatchConsultantDTO = {
	encourage2fa?: boolean;
	displayName?: string;
	walkThroughEnabled?: boolean;
};

export const apiPatchConsultantData = async (
	consultantData: PatchConsultantDTO
): Promise<any> => {
	const url = endpoints.userData;
	const bodyData = JSON.stringify(consultantData);

	return fetchData({
		bodyData: bodyData,
		url: url,
		method: FETCH_METHODS.PATCH,
		responseHandling: [FETCH_ERRORS.CONFLICT_WITH_RESPONSE]
	});
};
