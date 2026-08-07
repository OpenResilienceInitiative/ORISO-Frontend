import { FETCH_ERRORS } from '../../api/fetchData';
import { TwoFactorType } from '../twoFactorAuth/twoFactorAuthConstants';

/**
 * Keycloak answers the password grant of a disabled account with
 * `400 {"error":"invalid_grant","error_description":"Account disabled"}`.
 *
 * The identity provider is disabled for *every* account that has been marked
 * for deletion - no matter whether the advice seeker deleted it themselves or
 * a counsellor closed it. Keycloak carries no information about who triggered
 * it, so the login screen must not claim an actor. See ORISO-Frontend#977.
 */
const ACCOUNT_DISABLED_DESCRIPTION = /account disabled/i;

export const LOGIN_ERROR_KEYS = {
	ACCOUNT_DELETED: 'login.warning.failed.accountDeleted',
	UNAUTHORIZED: 'login.warning.failed.unauthorized.text',
	UNAUTHORIZED_OTP: 'login.warning.failed.unauthorized.otp'
} as const;

export type LoginErrorResolution =
	/** Show `messageKey` as the login error. */
	| { kind: 'message'; messageKey: string }
	/** Credentials were fine, a second factor is required. */
	| { kind: 'otpRequired'; otpType: TwoFactorType }
	/** Nothing to tell the user about. */
	| { kind: 'none' };

interface LoginErrorLike {
	message?: string;
	options?: {
		data?: {
			error_description?: string;
			otpType?: TwoFactorType;
		};
	};
}

/**
 * Maps a failed login attempt onto the message the advice seeker should see.
 *
 * @param error the rejection of `autoLogin`
 * @param hasOtp whether the attempt already carried a one-time password
 */
export const resolveLoginError = (
	error: LoginErrorLike | null | undefined,
	hasOtp: boolean
): LoginErrorResolution => {
	if (!error) {
		return { kind: 'none' };
	}

	if (error.message === FETCH_ERRORS.UNAUTHORIZED) {
		return {
			kind: 'message',
			messageKey: hasOtp
				? LOGIN_ERROR_KEYS.UNAUTHORIZED_OTP
				: LOGIN_ERROR_KEYS.UNAUTHORIZED
		};
	}

	if (hasOtp || error.message !== FETCH_ERRORS.BAD_REQUEST) {
		return { kind: 'none' };
	}

	const data = error.options?.data;

	if (ACCOUNT_DISABLED_DESCRIPTION.test(data?.error_description ?? '')) {
		return {
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED
		};
	}

	if (data?.otpType) {
		return { kind: 'otpRequired', otpType: data.otpType };
	}

	return { kind: 'none' };
};
