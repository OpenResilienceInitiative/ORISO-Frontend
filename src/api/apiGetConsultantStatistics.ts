import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

/** How the backend splits the period: days, Monday-to-Sunday weeks or months. */
export type ConsultantStatisticsBreakdown = 'DAY' | 'WEEK' | 'MONTH';

export interface ConsultantStatisticsDTO {
	startDate: string;
	endDate: string;
	numberOfAssignedSessions: number;
	numberOfActiveSessions: number;
	numberOfSentMessages: number;
	/** Realised 1:1 appointments (started, not cancelled); absent on older backends. */
	numberOfAppointments?: number;
	numberOfVideoAppointments?: number;
	numberOfPhoneAppointments?: number;
	numberOfOnsiteAppointments?: number;
	numberOfChatAppointments?: number;
	numberOfCancelledAppointments?: number;
	/** One entry per part when a breakdown was asked for. */
	breakdown?: ConsultantStatisticsDTO[];
}

export interface ApiGetConsultantStatisticsInterface {
	startDate: string;
	endDate: string;
	breakdown?: ConsultantStatisticsBreakdown;
	/** Without it an error status leaves for the error page. */
	responseHandling?: string[];
}

export const apiGetConsultantStatistics = async ({
	startDate,
	endDate,
	breakdown,
	responseHandling
}: ApiGetConsultantStatisticsInterface): Promise<ConsultantStatisticsDTO> => {
	const url =
		endpoints.consultantStatistics +
		`?startDate=${startDate}&endDate=${endDate}` +
		(breakdown ? `&breakdown=${breakdown}` : '');

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		...(responseHandling ? { responseHandling } : {})
	});
};
