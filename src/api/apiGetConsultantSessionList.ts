import { endpoints } from '../resources/scripts/endpoints';
import {
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../components/session/sessionHelpers';
import { ListItemsResponseInterface } from '../globalState/interfaces';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from './fetchData';

export const INITIAL_OFFSET: number = 0;
export const SESSION_COUNT: number = 15;
export const TIMEOUT: number = 10000;

export interface ApiGetConsultantSessionListInterface {
	type: SESSION_LIST_TYPES;
	offset?: number;
	sessionListTab?: string;
	count?: number;
	signal?: AbortSignal;
}

export const apiGetConsultantSessionList = async ({
	type,
	offset = INITIAL_OFFSET,
	sessionListTab,
	count = SESSION_COUNT,
	signal
}: ApiGetConsultantSessionListInterface): Promise<ListItemsResponseInterface> => {
	let url: string;
	if (type === SESSION_LIST_TYPES.MY_SESSION) {
		url = `${
			sessionListTab === SESSION_LIST_TAB_ARCHIVE
				? `${endpoints.myMessagesBase}${SESSION_LIST_TAB_ARCHIVE}?`
				: `${endpoints.consultantSessions}`
		}`;
	} else {
		url = `${endpoints.consultantEnquiriesBase}registered?`;
	}
	
	// Archive endpoint doesn't accept filter parameter - it causes 400 error
	if (sessionListTab === SESSION_LIST_TAB_ARCHIVE) {
		url = url + `count=${count}&offset=${offset}`;
	} else {
	url = url + `count=${count}&filter=all&offset=${offset}`;
	}

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		rcValidation: true,
		responseHandling: [FETCH_ERRORS.EMPTY],
		timeout: TIMEOUT,
		...(signal && { signal: signal })
	});
};
