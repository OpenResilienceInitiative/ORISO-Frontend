import { apiUrl } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * What an invite link leads to, readable without redeeming it — public, no
 * account: GET /service/users/invitelinks/{token}/context.
 */
export interface InviteLinkContext {
	tenantId: number | null;
	agencyId: number | null;
	consultingTypeId: number | null;
	topicId: number | null;
	chatType: string | null;
	/** Counsellor direct links only (ORISO-UserService#1479): new people get a temporary account. */
	temporaryAccount?: boolean | null;
	/** Counsellor direct links only: `KNOCK` for audio and video, `DIRECT` for chat. */
	admission?: 'DIRECT' | 'KNOCK' | null;
}

/* The page waits on this before it either opens the live-chat room or falls
   back to redeeming on arrival, so a server that never answers must not hold
   every invite on the loader. */
const CONTEXT_TIMEOUT_MS = 8_000;

export const apiGetInviteLinkContext = (
	token: string
): Promise<InviteLinkContext> =>
	fetchData({
		url: `${apiUrl}/service/users/invitelinks/${encodeURIComponent(token)}/context`,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		/* The response on failure: a switched-off direct link answers 410
		   and the page says so instead of trying to redeem it. */
		responseHandling: [FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE],
		timeout: CONTEXT_TIMEOUT_MS
	});
