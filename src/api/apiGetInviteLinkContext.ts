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
	/** The public context marks a link to one already-running call. */
	linkKind?: 'CALL';
	/** Counsellor direct links only (ORISO-UserService#1479): new people get a temporary account. */
	temporaryAccount?: boolean | null;
	/** Counsellor direct links only: `KNOCK` for audio and video, `DIRECT` for chat. */
	admission?: 'DIRECT' | 'KNOCK' | null;
	/** Temporary direct links only (ORISO-UserService#1486): the account still gets a password. */
	hidePasswordField?: boolean | null;
	/** Temporary direct links only: what happens to the guest's messages. */
	messageRetention?:
		| 'ALWAYS_TEMPORARY'
		| 'GUEST_DECIDES'
		| 'ALWAYS_PERSISTENT'
		| null;
	/** #2252 Direkteinladung: who may enter; the page offers only the allowed ways. */
	accessMode?: 'GUESTS_ONLY' | 'ACCOUNTS_ONLY' | 'BOTH' | null;
	/** #2252: whether the call waits for the counsellor. */
	knock?: boolean | null;
	/** #2252, with an appointment only (ISO instants). */
	appointmentStartTime?: string | null;
	appointmentEndTime?: string | null;
	/** #2252: the call waiting room opens then; the chat works at once. */
	callOpensAt?: string | null;
	/** #2252: afterwards the link answers 410 `DIRECT_LINK_EXPIRED`. */
	expiresAt?: string | null;
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
