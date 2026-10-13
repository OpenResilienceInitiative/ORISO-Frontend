import { endpoints } from '../resources/scripts/endpoints';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';

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

/** Rejects on failure, so callers can tell an error from an empty list. */
export const apiFetchUserDrafts = (
	page = 0,
	perPage = 200
): Promise<IUserDraftFeedResponse> =>
	fetchData({
		url: `${endpoints.userDrafts}?page=${page}&perPage=${perPage}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});

export const apiGetUserDrafts = async (
	page = 0,
	perPage = 200
): Promise<IUserDraftFeedResponse> => {
	try {
		return await apiFetchUserDrafts(page, perPage);
	} catch {
		return { items: [], page, perPage };
	}
};

export const apiGetUserDraft = async (
	scopeKey: string,
	signal?: AbortSignal
): Promise<IUserDraftItem | null> => {
	try {
		return await fetchData({
			url: `${endpoints.userDrafts}/single?scopeKey=${encodeURIComponent(scopeKey)}`,
			method: FETCH_METHODS.GET,
			responseHandling: [
				FETCH_ERRORS.EMPTY,
				FETCH_ERRORS.CATCH_ALL,
				FETCH_SUCCESS.CONTENT
			],
			...(signal && { signal })
		});
	} catch (e: any) {
		if (e?.message === FETCH_ERRORS.EMPTY) {
			throw e;
		}
		return null;
	}
};

export const apiUpsertUserDraft = async (
	scopeKey: string,
	payload: Omit<IUserDraftItem, 'id' | 'scopeKey' | 'updatedAt'>,
	signal?: AbortSignal
): Promise<void> => {
	try {
		await fetchData({
			url: `${endpoints.userDrafts}?scopeKey=${encodeURIComponent(scopeKey)}`,
			method: FETCH_METHODS.PATCH,
			bodyData: JSON.stringify(payload),
			responseHandling: [FETCH_ERRORS.CATCH_ALL],
			...(signal && { signal })
		});
		// Lists showing drafts (sessions, timeline) refetch; no content is sent along.
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	} catch {
		// Drafts are non-critical: a failed/conflicting autosave must never bubble up
		// and break the chat. The next keystroke re-saves.
	}
};

export const apiDeleteUserDraft = async (
	scopeKey: string,
	signal?: AbortSignal
): Promise<void> => {
	try {
		await fetchData({
			url: `${endpoints.userDrafts}?scopeKey=${encodeURIComponent(scopeKey)}`,
			method: FETCH_METHODS.DELETE,
			responseHandling: [FETCH_ERRORS.CATCH_ALL],
			...(signal && { signal })
		});
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	} catch {
		// Non-critical cleanup; ignore failures.
	}
};
