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

/**
 * Keycloak's password grant reports every credential problem - wrong
 * username, wrong password, wrong or missing one-time code - as
 * `400 {"error":"invalid_grant","error_description":"Invalid user credentials"}`.
 * It never sends a 401 for that; 401 is reserved for a misconfigured client.
 * Until 2026-09 the screen only knew the 401 path and therefore stayed silent
 * on every real credential mistake (ORISO-Frontend#1402 was reported with the
 * same "the button does nothing" symptom).
 */
const INVALID_GRANT = 'invalid_grant';

export const LOGIN_ERROR_KEYS = {
	ACCOUNT_DELETED: 'login.warning.failed.accountDeleted',
	UNAUTHORIZED: 'login.warning.failed.unauthorized.text',
	UNAUTHORIZED_OTP: 'login.warning.failed.unauthorized.otp',
	/** Anything that is not the user's fault: network, 5xx, malformed answers. */
	UNAVAILABLE: 'login.warning.failed.unavailable'
} as const;

/**
 * Why a login attempt failed, in the vocabulary the telemetry counter uses.
 * Deliberately coarse: it must never allow a per-user or per-account reading.
 */
export type LoginFailureOutcome =
	| 'credentials'
	| 'otp_required'
	| 'account_disabled'
	| 'unavailable';

export type LoginErrorResolution =
	/** Show `messageKey` as the login error. */
	| { kind: 'message'; messageKey: string; outcome: LoginFailureOutcome }
	/** Credentials were fine, a second factor is required. */
	| { kind: 'otpRequired'; otpType: TwoFactorType; outcome: 'otp_required' }
	/** Nothing failed (no error object at all). */
	| { kind: 'none' };

interface LoginErrorLike {
	message?: string;
	options?: {
		data?: {
			error?: string;
			error_description?: string;
			otpType?: TwoFactorType;
		};
	};
}

/**
 * How the failure reached us, for the telemetry counter. `network` covers a
 * fetch that never got an HTTP answer (offline, DNS, CORS, aborted).
 */
export type LoginFailureTransport =
	| 'bad_request'
	| 'unauthorized'
	| 'network'
	| 'unexpected';

export const describeLoginTransport = (
	error: LoginErrorLike | null | undefined
): LoginFailureTransport => {
	switch (error?.message) {
		case FETCH_ERRORS.BAD_REQUEST:
			return 'bad_request';
		case FETCH_ERRORS.UNAUTHORIZED:
			return 'unauthorized';
		case 'keycloakLogin':
			return 'network';
		default:
			return 'unexpected';
	}
};

const credentialsMessage = (hasOtp: boolean): LoginErrorResolution => ({
	kind: 'message',
	messageKey: hasOtp
		? LOGIN_ERROR_KEYS.UNAUTHORIZED_OTP
		: LOGIN_ERROR_KEYS.UNAUTHORIZED,
	outcome: 'credentials'
});

const unavailableMessage = (): LoginErrorResolution => ({
	kind: 'message',
	messageKey: LOGIN_ERROR_KEYS.UNAVAILABLE,
	outcome: 'unavailable'
});

/**
 * Maps a failed login attempt onto the message the advice seeker should see.
 *
 * Every failure produces *some* visible outcome. The only silent path left is
 * the absence of an error object, which is not a failure. A wrong password,
 * a wrong one-time code and an unknown username share one message on
 * purpose: the form must not reveal which of them was wrong, and Keycloak
 * does not tell us either.
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
		return credentialsMessage(hasOtp);
	}

	if (error.message !== FETCH_ERRORS.BAD_REQUEST) {
		// Network failure, 5xx, unparsable body: nothing the user can fix.
		return unavailableMessage();
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
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED,
			outcome: 'account_disabled'
		};
	}

	/*
	 * The realm asks for the second factor: the password was right. Once a
	 * code has been submitted, asking again would loop the form - a 400 with
	 * a code attached is a credential problem and says so.
	 */
	if (data?.otpType && !hasOtp) {
		return {
			kind: 'otpRequired',
			otpType: data.otpType,
			outcome: 'otp_required'
		};
	}

	if (data?.otpType || data?.error === INVALID_GRANT) {
		return credentialsMessage(hasOtp);
	}

	// e.g. `invalid_client`: a deployment problem, not a user mistake.
	return unavailableMessage();
};
