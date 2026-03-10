import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';

export interface IUserDraftItem {
	id?: number;
	scopeKey: string;
	text: string;
	actionPath?: string | null;
	title?: string | null;
	sourceSessionId?: number | null;
	roomRef?: string | null;
	threadRootId?: string | null;
	updatedAt?: string | null;
}

export interface IUserDraftFeedResponse {
	items: IUserDraftItem[];
	page: number;
	perPage: number;
}

export const apiGetUserDrafts = async (
	page = 0,
	perPage = 200
): Promise<IUserDraftFeedResponse> =>
	fetchData({
		url: `${endpoints.userDrafts}?page=${page}&perPage=${perPage}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});

export const apiGetUserDraft = async (
	scopeKey: string,
	signal?: AbortSignal
): Promise<IUserDraftItem> =>
	fetchData({
		url: `${endpoints.userDrafts}/single?scopeKey=${encodeURIComponent(scopeKey)}`,
		method: FETCH_METHODS.GET,
		responseHandling: [
			FETCH_ERRORS.EMPTY,
			FETCH_ERRORS.CATCH_ALL,
			FETCH_SUCCESS.CONTENT
		],
		...(signal && { signal })
	});

export const apiUpsertUserDraft = async (
	scopeKey: string,
	payload: Omit<IUserDraftItem, 'id' | 'scopeKey' | 'updatedAt'>
): Promise<void> =>
	fetchData({
		url: `${endpoints.userDrafts}?scopeKey=${encodeURIComponent(scopeKey)}`,
		method: FETCH_METHODS.PATCH,
		bodyData: JSON.stringify(payload),
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});

export const apiDeleteUserDraft = async (scopeKey: string): Promise<void> =>
	fetchData({
		url: `${endpoints.userDrafts}?scopeKey=${encodeURIComponent(scopeKey)}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});


