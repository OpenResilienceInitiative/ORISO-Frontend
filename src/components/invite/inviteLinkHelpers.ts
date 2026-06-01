import { setTokens } from '../auth/auth';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import { APP_PATH } from '../../resources/scripts/config';
import { RedeemInviteLinkSessionResponse } from '../../api/apiRedeemInviteLink';

export const buildInviteSessionAppUrl = (
	sessionId: number | string,
	rcGroupId?: string | null
): string => {
	const basePath = `/${APP_PATH}/sessions/user/view`;
	const groupId = rcGroupId?.trim();
	const isMatrixRoomId =
		Boolean(groupId) && (groupId.startsWith('!') || groupId.includes(':'));

	if (groupId && !isMatrixRoomId) {
		return `${window.location.origin}${basePath}/${encodeURIComponent(groupId)}/${sessionId}`;
	}

	return `${window.location.origin}${basePath}/session/${sessionId}`;
};

/** Apply Keycloak + Matrix/RC credentials returned by the new redeem endpoint. */
export const applyRedeemSessionCredentials = (
	data: RedeemInviteLinkSessionResponse
): void => {
	setTokens(
		data.accessToken,
		data.expiresIn,
		data.refreshToken,
		data.refreshExpiresIn
	);
	setValueInCookie('rc_uid', data.rcUserId);
	setValueInCookie('rc_token', data.rcToken);
	localStorage.setItem('matrix_user_id', data.rcUserId);
	localStorage.setItem('matrix_access_token', data.rcToken);
	generateCsrfToken(true);
};

export const redirectToInviteSession = (
	data: RedeemInviteLinkSessionResponse
): void => {
	window.location.href = buildInviteSessionAppUrl(
		data.sessionId,
		data.rcGroupId
	);
};
