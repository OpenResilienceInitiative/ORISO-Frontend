import { parseJwt } from '../../utils/parseJWT';
import {
	removeRocketChatMasterKeyFromLocalStorage,
	removeTokenExpiryFromLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { removeAllCookies } from '../sessionCookie/accessSessionCookie';

export const CONSULTANT_LOGIN_BLOCKED_ERROR = 'CONSULTANT_LOGIN_BLOCKED';
export const CONSULTANT_LOGIN_BLOCKED_SESSION_KEY =
	'oriso.consultantLoginBlocked';

export const clearAuthSession = () => {
	removeAllCookies();
	removeTokenExpiryFromLocalStorage();
	removeRocketChatMasterKeyFromLocalStorage();
};

export const isConsultantAccessToken = (accessToken?: string) => {
	if (!accessToken) {
		return false;
	}

	const tokenPayload = parseJwt(accessToken);
	return tokenPayload?.realm_access?.roles?.includes('consultant') ?? false;
};

export const markConsultantLoginBlocked = () => {
	sessionStorage.setItem(CONSULTANT_LOGIN_BLOCKED_SESSION_KEY, '1');
};

export const consumeConsultantLoginBlocked = () => {
	if (sessionStorage.getItem(CONSULTANT_LOGIN_BLOCKED_SESSION_KEY)) {
		sessionStorage.removeItem(CONSULTANT_LOGIN_BLOCKED_SESSION_KEY);
		return true;
	}

	return false;
};
