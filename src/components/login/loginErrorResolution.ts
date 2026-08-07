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

	if (error.message !== FETCH_ERRORS.BAD_REQUEST) {
		return { kind: 'none' };
	}

	const data = error.options?.data;

	/*
	 * Classify the disabled account before anything else a 400 can mean. A
	 * user with a second factor reaches this branch *after* submitting their
	 * one-time password, and suppressing the message for them would leave the
	 * screen silent - the very gap this resolution was extracted to close.
	 */
	if (ACCOUNT_DISABLED_DESCRIPTION.test(data?.error_description ?? '')) {
		return {
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED
		};
	}

	/*
	 * Past this point a 400 only ever asks for a second factor. Once one has
	 * been submitted, asking again would put the form into a loop, so the
	 * request is answered with silence rather than a repeated prompt.
	 */
	if (hasOtp) {
		return { kind: 'none' };
	}

	if (data?.otpType) {
		return { kind: 'otpRequired', otpType: data.otpType };
	}

	return { kind: 'none' };
};
