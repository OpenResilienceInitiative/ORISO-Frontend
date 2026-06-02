import { apiUrl } from '../resources/scripts/endpoints';
import { FETCH_METHODS } from './fetchData';

/** Response from POST /service/users/invitelinks/{token}/redeem (topic-based links). */
export interface RedeemInviteLinkSessionResponse {
	sessionId: number;
	userName: string;
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	refreshExpiresIn: number;
	rcUserId: string;
	rcToken: string;
	rcGroupId: string;
}

/** Legacy agency-based redeem payload (older backend / agency invite links). */
export interface RedeemInviteLinkLegacyResponse {
	tenantId: number;
	agencyId: number;
	consultingTypeId: number | null;
}

export type RedeemInviteLinkResponse =
	| RedeemInviteLinkSessionResponse
	| RedeemInviteLinkLegacyResponse;

export const isRedeemInviteLinkSessionResponse = (
	data: RedeemInviteLinkResponse
): data is RedeemInviteLinkSessionResponse =>
	typeof (data as RedeemInviteLinkSessionResponse).accessToken === 'string' &&
	typeof (data as RedeemInviteLinkSessionResponse).sessionId === 'number';

export const redeemInviteLink = async (
	token: string
): Promise<RedeemInviteLinkResponse> => {
	const url = `${apiUrl}/service/users/invitelinks/${encodeURIComponent(token)}/redeem`;
	const response = await fetch(url, {
		method: FETCH_METHODS.POST,
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include'
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(body || `Redeem failed (HTTP ${response.status})`);
	}

	return response.json();
};
