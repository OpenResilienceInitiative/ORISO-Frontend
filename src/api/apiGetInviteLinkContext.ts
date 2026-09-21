import { apiUrl } from '../resources/scripts/endpoints';
import { FETCH_METHODS } from './fetchData';

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
}

export const apiGetInviteLinkContext = async (
	token: string
): Promise<InviteLinkContext> => {
	const url = `${apiUrl}/service/users/invitelinks/${encodeURIComponent(token)}/context`;
	const response = await fetch(url, {
		method: FETCH_METHODS.GET,
		headers: { Accept: 'application/json' }
	});
	if (!response.ok) {
		throw new Error(`Invite context failed (HTTP ${response.status})`);
	}
	return response.json();
};
