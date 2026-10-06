import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Marks an anonymous live-chat session as finished (status DONE).
 * Callable by the session's anonymous asker (USER or ANONYMOUS role) or their consultant.
 *
 * `asGuestAccessToken` finishes it as that guest without the browser's own
 * session: used when a redeemed guest must be withdrawn but the browser now
 * holds someone else's credentials (a counsellor who signed in meanwhile),
 * which must neither be used nor overwritten.
 */
export const apiFinishAnonymousConversation = (
	sessionId: number | string,
	asGuestAccessToken?: string
): Promise<void> =>
	fetchData({
		url: endpoints.finishAnonymousConversation(sessionId),
		method: FETCH_METHODS.PUT,
		...(asGuestAccessToken && {
			skipAuth: true,
			headersData: { Authorization: `Bearer ${asGuestAccessToken}` }
		}),
		responseHandling: [
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.CATCH_ALL
		]
	});
