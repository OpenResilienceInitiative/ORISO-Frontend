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
	UNAVAILABLE: 'login.warning.failed.unavailable',
	/**
	 * The realm refuses to send another code because the per-window ceiling is
	 * reached (#1338). Not a credential problem, so it must not share the
	 * deliberately vague credentials message: here the user CAN act, by waiting.
	 */
	TOO_MANY_CODES: 'login.warning.failed.tooManyCodes',
	/** Same, but the realm told us how long — so the message can name it. */
	TOO_MANY_CODES_WAIT: 'login.warning.failed.tooManyCodesWait'
} as const;

/**
 * Why a login attempt failed, in the vocabulary the telemetry counter uses.
 * Deliberately coarse: it must never allow a per-user or per-account reading.
 */
export type LoginFailureOutcome =
	| 'credentials'
	| 'otp_required'
	| 'account_disabled'
	| 'rate_limited'
	| 'unavailable';

export type LoginErrorResolution =
	/**
	 * Show `messageKey` as the login error. `waitSeconds` is set when the
	 * message is about waiting, so the screen can name the time instead of
	 * "please try again later".
	 */
	| {
			kind: 'message';
			messageKey: string;
			outcome: LoginFailureOutcome;
			waitSeconds?: number;
	  }
	/**
	 * Credentials were fine, a second factor is required. `resendAvailableInSeconds`
	 * is what the realm says the client must wait before asking for another code;
	 * absent when the realm is older than #1338.
	 */
	| {
			kind: 'otpRequired';
			otpType: TwoFactorType;
			outcome: 'otp_required';
			resendAvailableInSeconds?: number;
	  }
	/** Nothing failed (no error object at all). */
	| { kind: 'none' };

interface LoginErrorLike {
	message?: string;
	options?: {
		data?: {
			error?: string;
			error_description?: string;
			otpType?: TwoFactorType;
			resendAvailableInSeconds?: number;
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
	| 'too_many_requests'
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
		case FETCH_ERRORS.TOO_MANY_REQUESTS:
			return 'too_many_requests';
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

/**
 * Only a usable number reaches the UI. A realm from before #1338 sends nothing,
 * and a broken or zero value must leave the countdown to its own default rather
 * than render "wait 0 seconds" or NaN.
 */
const positiveSeconds = (value: unknown): { waitSeconds?: number } =>
	typeof value === 'number' && Number.isFinite(value) && value > 0
		? { waitSeconds: Math.ceil(value) }
		: {};

const resendSeconds = (
	value: unknown
): { resendAvailableInSeconds?: number } =>
	typeof value === 'number' && Number.isFinite(value) && value > 0
		? { resendAvailableInSeconds: Math.ceil(value) }
		: {};

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

	if (error.message === FETCH_ERRORS.TOO_MANY_REQUESTS) {
		// The ceiling on code mails, not an outage and not a wrong password.
		// Saying so lets the form show a countdown instead of "try again later".
		const wait = positiveSeconds(
			error.options?.data?.resendAvailableInSeconds
		);
		return {
			kind: 'message',
			messageKey: wait.waitSeconds
				? LOGIN_ERROR_KEYS.TOO_MANY_CODES_WAIT
				: LOGIN_ERROR_KEYS.TOO_MANY_CODES,
			outcome: 'rate_limited',
			...wait
		};
	}

	if (error.message === FETCH_ERRORS.UNAUTHORIZED) {
		// Keycloak never answers wrong credentials with 401; `autoLogin` uses
		// this code for a misconfigured client and for a tenant mismatch.
		// Neither is something the user can fix by retyping.
		return unavailableMessage();
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
			outcome: 'otp_required',
			...resendSeconds(data.resendAvailableInSeconds)
		};
	}

	if (data?.otpType || data?.error === INVALID_GRANT) {
		return credentialsMessage(hasOtp);
	}

	// e.g. `invalid_client`: a deployment problem, not a user mistake.
	return unavailableMessage();
};
