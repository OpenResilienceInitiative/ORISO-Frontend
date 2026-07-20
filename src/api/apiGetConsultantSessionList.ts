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
	 * Enquiry list — pull BOTH feeds and merge:
	 *  - /enquiries/registered: registered enquiries plus legacy anonymous
	 *    flows that store sessions under registration_type=REGISTERED.
	 *  - /enquiries/anonymous: true registration_type=ANONYMOUS live-chat
	 *    sessions, including topic-queue sessions created from a LIVE_CHAT
	 *    invite link (cross-agency / cross-tenant topic queue).
	 * The client-side "Chats" vs "Live Chat" split still applies afterwards.
	 */
	const query = `count=${count}&filter=all&offset=${offset}`;
	const registeredUrl = `${endpoints.consultantEnquiriesBase}registered?${query}`;
	const anonymousUrl = `${endpoints.consultantEnquiriesBase}anonymous?${query}`;

	/*
	 * Each feed answers 204 (rejected as FETCH_ERRORS.EMPTY) when IT is empty.
	 * One empty feed must not fail the merge: a consultant with zero
	 * registered enquiries but a filled live-chat topic queue would otherwise
	 * see "no enquiries" although the anonymous feed returned sessions.
	 * Only when BOTH feeds are empty the merged list is genuinely empty and
	 * the EMPTY error is re-thrown so the existing empty-state handling runs.
	 */
	const [registered, anonymous] = await Promise.all([
		fetchListUrl(registeredUrl, signal).catch((error) => {
			if (error?.message === FETCH_ERRORS.EMPTY) {
				return null;
			}
			throw error;
		}),
		// The anonymous queue is best-effort: a failure there must not hide the
		// registered enquiries a consultant is responsible for. It must be
		// loud, though — a silent empty result is indistinguishable from
		// "no live chat enquiries" and hides backend 500s from diagnosis.
		fetchListUrl(anonymousUrl, signal).catch((error) => {
			if (error?.message !== FETCH_ERRORS.EMPTY) {
				console.error(
					'Anonymous enquiry feed failed — live chat enquiries may be missing from the list:',
					error
				);
			}
			return null;
		})
	]);

	if (!registered && !anonymous) {
		throw new Error(FETCH_ERRORS.EMPTY);
	}

	return mergeEnquiryFeeds(registered, anonymous);
};

/** Merge two enquiry feeds, de-duplicating by session id (registered wins on conflict). */
const mergeEnquiryFeeds = (
	registered: ListItemsResponseInterface | null,
	anonymous: ListItemsResponseInterface | null
): ListItemsResponseInterface => {
	const registeredSessions = registered?.sessions ?? [];
	const anonymousSessions = anonymous?.sessions ?? [];
	const seen = new Set(
		registeredSessions.map((item: any) => item?.session?.id)
	);
	const merged = [
		...registeredSessions,
		...anonymousSessions.filter((item: any) => !seen.has(item?.session?.id))
	];
	/* Base the pagination envelope (offset/count/total) on whichever feed
	 * actually answered — with an empty registered feed the anonymous feed
	 * carries the only valid envelope. */
	const base = registered ?? anonymous ?? ({} as ListItemsResponseInterface);
	return { ...base, sessions: merged };
};
