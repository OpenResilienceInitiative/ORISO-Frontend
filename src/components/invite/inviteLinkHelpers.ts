import { setTokens } from '../auth/auth';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import { RedeemInviteLinkSessionResponse } from '../../api/apiRedeemInviteLink';

export const buildInviteSessionAppUrl = (sessionId: number | string): string =>
	`${window.location.origin}/sessions/user/view/session/${sessionId}`;

/** Apply the identity credentials returned by the invite redeem endpoint. */
export const applyRedeemSessionCredentials = (
	data: RedeemInviteLinkSessionResponse
): void => {
	setTokens(
		data.accessToken,
		data.expiresIn,
		data.refreshToken,
		data.refreshExpiresIn
	);
	generateCsrfToken(true);
};

export const redirectToInviteSession = (
	data: RedeemInviteLinkSessionResponse
): void => {
	window.location.href = buildInviteSessionAppUrl(data.sessionId);
};
