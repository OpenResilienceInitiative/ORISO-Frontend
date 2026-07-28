import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export interface ChatOccurrence {
	seriesId: number;
	occurrenceIndex: number;
	originalStart: string;
	start: string;
	duration: number;
	capacity?: number;
	modality: 'TEXT' | 'AUDIO' | 'VIDEO';
}

export const apiGetChatOccurrences = (
	seriesId: number,
	from: string,
	to: string,
	limit = 50
): Promise<ChatOccurrence[]> => {
	const query = new URLSearchParams({
		from,
		to,
		limit: String(limit)
	});
	return fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/occurrences?${query}`,
		method: FETCH_METHODS.GET
	});
};

export const apiSkipChatOccurrence = (
	seriesId: number,
	originalStartUtc: string
): Promise<void> => {
	const query = new URLSearchParams({ originalStartUtc });
	return fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/occurrences/skip?${query}`,
		method: FETCH_METHODS.POST
	});
};
