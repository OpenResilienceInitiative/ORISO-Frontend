import { apiUrl } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';
import type { GuestAccountMode } from '../components/guestAccountMode/guestAccountMode';

/** UserService#1662: the public part of a Gesprächskreis invite. */
export interface GroupInviteContext {
	/** The circle's mode, already capped by the platform and the Träger. */
	guestAccountMode?: GuestAccountMode | null;
}

/* The entry waits on this before it shows a way to join, so a server that
   never answers must not hold the newcomer on the loader. */
const CONTEXT_TIMEOUT_MS = 8_000;

/**
 * Public, no account: GET /service/users/chat/{chatId}/invite-context. The
 * server answers only for the link's own agency and invite token.
 */
export const apiGetGroupInviteContext = (
	chatId: number,
	agencyId: string,
	inviteToken: string
): Promise<GroupInviteContext> => {
	const query = new URLSearchParams({ agencyId, inviteToken });
	return fetchData({
		url: `${apiUrl}/service/users/chat/${encodeURIComponent(chatId)}/invite-context?${query}`,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		timeout: CONTEXT_TIMEOUT_MS
	});
};
