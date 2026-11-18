import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * UserService#1662: a guest who entered without an account under "Gast
 * wählt" keeps it. The server sets the new password, clears the temporary
 * flag and answers 204.
 *
 * Refusals: 400 the password breaks the policy, 403 the account was not
 * created under "Gast wählt", 404 no account, 409 the account is no longer
 * temporary or is being deleted.
 */
export const apiKeepTemporaryAccount = (password: string): Promise<unknown> =>
	fetchData({
		url: endpoints.keepTemporaryAccount,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ password }),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH,
			FETCH_ERRORS.CONFLICT
		]
	});

const ERROR_KEYS: Record<string, string> = {
	[FETCH_ERRORS.BAD_REQUEST]: 'guestAccountMode.keep.error.badRequest',
	[FETCH_ERRORS.FORBIDDEN]: 'guestAccountMode.keep.error.forbidden',
	[FETCH_ERRORS.NO_MATCH]: 'guestAccountMode.keep.error.notFound',
	[FETCH_ERRORS.CONFLICT]: 'guestAccountMode.keep.error.conflict'
};

/** The i18n key of the message for a failed keep. */
export const keepTemporaryAccountErrorKey = (error: unknown): string =>
	(error instanceof Error && ERROR_KEYS[error.message]) ||
	'guestAccountMode.keep.error.generic';
