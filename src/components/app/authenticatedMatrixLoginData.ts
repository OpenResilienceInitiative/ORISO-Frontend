import type { MatrixLoginData } from '../sessionCookie/getMatrixAccessToken';

/** Keep transient login fields (notably UIA) when adding app-session context. */
export const withAuthenticatedSessionContext = (
	loginData: MatrixLoginData,
	isAnonymous: boolean
): MatrixLoginData => ({
	...loginData,
	isAnonymous
});
