import { apiUrl } from '../resources/scripts/endpoints';
import { FETCH_METHODS } from './fetchData';
import { getCounsellingDpaFailure } from './counsellingDpaFailure';
import { traceHeaders } from '../utils/observability/traceparent';

/** Response from POST /service/users/invitelinks/{token}/redeem (topic-based links). */
export interface RedeemInviteLinkSessionResponse {
	sessionId: number;
	userName: string;
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	refreshExpiresIn: number;
}

/** Legacy agency-based redeem payload (older backend / agency invite links). */
export interface RedeemInviteLinkLegacyResponse {
	tenantId: number;
	agencyId: number;
	consultingTypeId: number | null;
	topicId?: number | null;
}

export type RedeemInviteLinkResponse =
	| RedeemInviteLinkSessionResponse
	| RedeemInviteLinkLegacyResponse;

export const isRedeemInviteLinkSessionResponse = (
	data: RedeemInviteLinkResponse
): data is RedeemInviteLinkSessionResponse =>
	typeof (data as RedeemInviteLinkSessionResponse).accessToken === 'string' &&
	typeof (data as RedeemInviteLinkSessionResponse).sessionId === 'number';

export const isPausedInvite = async (error: unknown): Promise<boolean> => {
	if (!(error instanceof Response) || error.status !== 410) return false;
	const body = await error
		.clone()
		.json()
		.catch(() => null);
	return (
		body?.reason === 'INVITE_LINK_PAUSED' ||
		body?.reason === 'DIRECT_LINK_INACTIVE'
	);
};

/** The rolled User-ID was taken between offer and Join: roll again. */
export const isTakenGuestName = (error: unknown): boolean =>
	error instanceof Response && error.status === 409;

/**
 * @param userId the User-ID the guest rolled (`katze_sam_4821`). It becomes
 *   the login of the new account; without it the server rolls one. The server
 *   refuses a name the generator cannot produce (400) and a taken one (409).
 */
export const redeemInviteLink = async (
	token: string,
	userId?: string
): Promise<RedeemInviteLinkResponse> => {
	const url = `${apiUrl}/service/users/invitelinks/${encodeURIComponent(token)}/redeem`;
	const response = await fetch(url, {
		method: FETCH_METHODS.POST,
		headers: { 'Content-Type': 'application/json', ...traceHeaders(url) },
		credentials: 'include',
		...(userId ? { body: JSON.stringify({ username: userId }) } : {})
	});

	if (!response.ok) {
		if (
			response.status === 409 ||
			getCounsellingDpaFailure(response) ||
			(await isPausedInvite(response))
		)
			throw response;
		const body = await response.text().catch(() => '');
		throw new Error(body || `Redeem failed (HTTP ${response.status})`);
	}

	return response.json();
};
