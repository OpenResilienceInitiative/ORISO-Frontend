// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	describeLoginTransport,
	LOGIN_ERROR_KEYS,
	resolveLoginError
} from './loginErrorResolution';
import deCommon from '../../resources/i18n/de/common.json';
import enCommon from '../../resources/i18n/en/common.json';
import frCommon from '../../resources/i18n/fr/common.json';
import ruCommon from '../../resources/i18n/ru/common.json';
import tiCommon from '../../resources/i18n/ti/common.json';
import trCommon from '../../resources/i18n/tr/common.json';

const accountDisabledError = () => ({
	message: FETCH_ERRORS.BAD_REQUEST,
	options: {
		data: {
			error: 'invalid_grant',
			error_description: 'Account disabled'
		}
	}
});

const translationAt = (catalogue: any, key: string) =>
	key.split('.').reduce((node, segment) => node?.[segment], catalogue);

const invalidCredentialsError = (extra: Record<string, unknown> = {}) => ({
	message: FETCH_ERRORS.BAD_REQUEST,
	options: {
		data: {
			error: 'invalid_grant',
			error_description: 'Invalid user credentials',
			...extra
		}
	}
});

describe('resolveLoginError', () => {
	it('shows the deleted-account message when Keycloak reports a disabled account', () => {
		expect(resolveLoginError(accountDisabledError(), false)).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED,
			outcome: 'account_disabled'
		});
	});

	it('still shows the deleted-account message after a second factor was submitted', () => {
		expect(resolveLoginError(accountDisabledError(), true)).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED,
			outcome: 'account_disabled'
		});
	});

	it('asks for the second factor instead of showing an error', () => {
		expect(
			resolveLoginError(
				{
					message: FETCH_ERRORS.BAD_REQUEST,
					options: { data: { otpType: 'APP' as never } }
				},
				false
			)
		).toEqual({
			kind: 'otpRequired',
			otpType: 'APP',
			outcome: 'otp_required'
		});
	});

	it('does not ask for the second factor again once one was submitted, it says the code was wrong', () => {
		expect(
			resolveLoginError(
				{
					message: FETCH_ERRORS.BAD_REQUEST,
					options: { data: { otpType: 'APP' as never } }
				},
				true
			)
		).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED_OTP,
			outcome: 'credentials'
		});
	});

	// Keycloak answers a wrong password with 400 invalid_grant, never with 401.
	// Until 2026-09 only the 401 path had a message, so a plain typo in the
	// password left the screen silent (same symptom as ORISO-Frontend#1402).
	it('shows the credentials message for the 400 Keycloak really sends on a wrong password', () => {
		expect(resolveLoginError(invalidCredentialsError(), false)).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED,
			outcome: 'credentials'
		});
	});

	it('shows the OTP credentials message when the 400 arrives after a code was submitted', () => {
		expect(resolveLoginError(invalidCredentialsError(), true)).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED_OTP,
			outcome: 'credentials'
		});
	});

	it('still maps a 401 onto the credentials message', () => {
		expect(
			resolveLoginError({ message: FETCH_ERRORS.UNAUTHORIZED }, false)
		).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED,
			outcome: 'credentials'
		});
		expect(
			resolveLoginError({ message: FETCH_ERRORS.UNAUTHORIZED }, true)
		).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED_OTP,
			outcome: 'credentials'
		});
	});

	it('tells the user the login is unavailable for a bad request that is not about credentials', () => {
		expect(
			resolveLoginError(
				{
					message: FETCH_ERRORS.BAD_REQUEST,
					options: {
						data: {
							error: 'invalid_client',
							error_description: 'Invalid client'
						}
					}
				},
				false
			)
		).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAVAILABLE,
			outcome: 'unavailable'
		});
	});

	it('tells the user the login is unavailable on network errors and unexpected statuses', () => {
		[
			'keycloakLogin',
			'Unexpected status: 502',
			'Failed to parse Keycloak response JSON'
		].forEach((message) =>
			expect(resolveLoginError({ message }, false)).toEqual({
				kind: 'message',
				messageKey: LOGIN_ERROR_KEYS.UNAVAILABLE,
				outcome: 'unavailable'
			})
		);
	});

	it('is silent only when there is no error at all', () => {
		expect(resolveLoginError(null, false)).toEqual({ kind: 'none' });
		expect(resolveLoginError(undefined, true)).toEqual({ kind: 'none' });
	});

	it('never resolves an error object to silence', () => {
		const samples = [
			{ message: 'anything' },
			{ message: FETCH_ERRORS.BAD_REQUEST },
			{ message: FETCH_ERRORS.BAD_REQUEST, options: { data: {} } },
			invalidCredentialsError(),
			accountDisabledError()
		];
		samples.forEach((sample) => {
			expect(resolveLoginError(sample, false).kind).not.toBe('none');
			expect(resolveLoginError(sample, true).kind).not.toBe('none');
		});
	});

	it('translates the unavailable message in every shipped locale', () => {
		[deCommon, enCommon, frCommon, ruCommon, tiCommon, trCommon].forEach(
			(catalogue) =>
				expect(
					typeof translationAt(
						catalogue,
						LOGIN_ERROR_KEYS.UNAVAILABLE
					)
				).toBe('string')
		);
	});
});

describe('describeLoginTransport', () => {
	it('maps the four ways a failure reaches the browser', () => {
		expect(
			describeLoginTransport({ message: FETCH_ERRORS.BAD_REQUEST })
		).toBe('bad_request');
		expect(
			describeLoginTransport({ message: FETCH_ERRORS.UNAUTHORIZED })
		).toBe('unauthorized');
		expect(describeLoginTransport({ message: 'keycloakLogin' })).toBe(
			'network'
		);
		expect(
			describeLoginTransport({ message: 'Unexpected status: 503' })
		).toBe('unexpected');
		expect(describeLoginTransport(undefined)).toBe('unexpected');
	});
});

describe('deleted-account copy', () => {
	// ORISO-Frontend#977: the account is disabled in Keycloak both when the
	// advice seeker deletes it themselves and when a counsellor closes it.
	// The message must therefore never blame a counsellor - telling people an
	// untrue story about their own decision is not acceptable on a
	// counselling platform.
	const blamesACounsellor = [
		/beratungsfachkraft/i,
		/berater/i,
		/counsell?or/i
	];

	it('states the deletion without naming an actor (de)', () => {
		const message = translationAt(
			deCommon,
			LOGIN_ERROR_KEYS.ACCOUNT_DELETED
		);

		expect(message).toMatch(/gelöscht/i);
		expect(message).toMatch(/registrieren/i);
		blamesACounsellor.forEach((pattern) =>
			expect(message).not.toMatch(pattern)
		);
	});

	it('states the deletion without naming an actor (en)', () => {
		const message = translationAt(
			enCommon,
			LOGIN_ERROR_KEYS.ACCOUNT_DELETED
		);

		expect(message).toMatch(/deleted/i);
		expect(message).toMatch(/register/i);
		expect(message).not.toMatch(/closed by/i);
	});

	it('leaves no locale on the old "closed by a counsellor" wording', () => {
		[deCommon, enCommon, frCommon, ruCommon, tiCommon, trCommon].forEach(
			(catalogue) => {
				expect(
					translationAt(
						catalogue,
						'login.warning.failed.deletedAccount'
					)
				).toBeUndefined();
			}
		);
	});
});
