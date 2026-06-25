import { parseJwt } from '../../utils/parseJWT';
import {
	removeRocketChatMasterKeyFromLocalStorage,
	removeTokenExpiryFromLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { removeAllCookies } from '../sessionCookie/accessSessionCookie';

export const CONSULTANT_LOGIN_BLOCKED_ERROR = 'CONSULTANT_LOGIN_BLOCKED';

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
