// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FETCH_ERRORS } from '../../api/fetchData';
import { LOGIN_ERROR_KEYS, resolveLoginError } from './loginErrorResolution';
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

describe('resolveLoginError', () => {
	it('shows the deleted-account message when Keycloak reports a disabled account', () => {
		expect(resolveLoginError(accountDisabledError(), false)).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED
		});
	});

	it('still shows the deleted-account message after a second factor was submitted', () => {
		expect(resolveLoginError(accountDisabledError(), true)).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.ACCOUNT_DELETED
		});
	});

	it('does not ask for the second factor again once one was submitted', () => {
		expect(
			resolveLoginError(
				{
					message: FETCH_ERRORS.BAD_REQUEST,
					options: { data: { otpType: 'APP' } }
				},
				true
			)
		).toEqual({ kind: 'none' });
	});

	it('shows the credentials message for wrong username or password', () => {
		expect(
			resolveLoginError({ message: FETCH_ERRORS.UNAUTHORIZED }, false)
		).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED
		});
	});

	it('shows the OTP credentials message when a second factor was submitted', () => {
		expect(
			resolveLoginError({ message: FETCH_ERRORS.UNAUTHORIZED }, true)
		).toEqual({
			kind: 'message',
			messageKey: LOGIN_ERROR_KEYS.UNAUTHORIZED_OTP
		});
	});

	it('asks for the second factor instead of showing an error', () => {
		expect(
			resolveLoginError(
				{
					message: FETCH_ERRORS.BAD_REQUEST,
					options: { data: { otpType: 'APP' } }
				},
				false
			)
		).toEqual({ kind: 'otpRequired', otpType: 'APP' });
	});

	it('stays silent for an unrelated bad request', () => {
		expect(
			resolveLoginError(
				{
					message: FETCH_ERRORS.BAD_REQUEST,
					options: { data: { error_description: 'Invalid client' } }
				},
				false
			)
		).toEqual({ kind: 'none' });
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
