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

const fetchListUrl = (
	url: string,
	signal?: AbortSignal
): Promise<ListItemsResponseInterface> =>
	fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		rcValidation: true,
		responseHandling: [FETCH_ERRORS.EMPTY],
		timeout: TIMEOUT,
		...(signal && { signal: signal })
	});

export const apiGetConsultantSessionList = async ({
	type,
	offset = INITIAL_OFFSET,
	sessionListTab,
	count = SESSION_COUNT,
	signal
}: ApiGetConsultantSessionListInterface): Promise<ListItemsResponseInterface> => {
	if (type === SESSION_LIST_TYPES.MY_SESSION) {
		const base =
			sessionListTab === SESSION_LIST_TAB_ARCHIVE
				? `${endpoints.myMessagesBase}${SESSION_LIST_TAB_ARCHIVE}?`
				: `${endpoints.consultantSessions}`;
		/* Archive endpoint rejects the `filter` param with 400. */
		const query =
			sessionListTab === SESSION_LIST_TAB_ARCHIVE
				? `count=${count}&offset=${offset}`
				: `count=${count}&filter=all&offset=${offset}`;
		return fetchListUrl(base + query, signal);
	}

	/*
	 * Enquiry list — always pull /enquiries/registered. The split between
	 * "Chats" and "Live Chat" happens client-side based on whether the
	 * session's asker-username starts with `Anonymous-` / `anon_` or uses
	 * postcode `00000`, because invite-link and legacy anonymous flows store
	 * sessions under registration_type=REGISTERED. The /enquiries/anonymous
	 * endpoint only lists registration_type=ANONYMOUS rows.
	 */
	const registeredUrl =
		`${endpoints.consultantEnquiriesBase}registered?` +
		`count=${count}&filter=all&offset=${offset}`;
	return fetchListUrl(registeredUrl, signal);
};
