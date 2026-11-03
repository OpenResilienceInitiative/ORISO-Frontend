import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export interface ConsultantStatisticsDTO {
	startDate: string;
	endDate: string;
	numberOfAssignedSessions: number;
	numberOfActiveSessions: number;
	numberOfSentMessages: number;
}

export interface ApiGetConsultantStatisticsInterface {
	startDate: string;
	endDate: string;
	/** Without it an error status leaves for the error page. */
	responseHandling?: string[];
}

export const apiGetConsultantStatistics = async ({
	startDate,
	endDate,
	responseHandling
}: ApiGetConsultantStatisticsInterface): Promise<ConsultantStatisticsDTO> => {
	const url =
		endpoints.consultantStatistics +
		`?startDate=${startDate}&endDate=${endDate}`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		...(responseHandling ? { responseHandling } : {})
	});
};
