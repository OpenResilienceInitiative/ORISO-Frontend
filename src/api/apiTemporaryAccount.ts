import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import type { TemporaryAccountState } from '../globalState/interfaces';

const handled = [FETCH_SUCCESS.CONTENT, FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE];

const statusOf = (error: unknown) =>
	typeof (error as Response)?.status === 'number'
		? (error as Response).status
		: undefined;

const isAccount = (value: unknown): value is TemporaryAccountState =>
	typeof (value as TemporaryAccountState | null)?.messageRetention ===
	'string';

/**
 * The signed-in guest's temporary account (ORISO-UserService#1486), or
 * `null` when the person has none (404: a normal account). An answer
 * without an account in it (an empty body or object, a 204) is a failed
 * lookup, never "no account" (#2009).
 */
export const apiGetTemporaryAccount =
	async (): Promise<TemporaryAccountState | null> => {
		try {
			const value = await fetchData({
				url: endpoints.temporaryAccount,
				method: FETCH_METHODS.GET,
				responseHandling: handled
			});
			if (!isAccount(value)) {
				throw new Error('temporary account lookup returned no account');
			}
			return value;
		} catch (error) {
			if (statusOf(error) === 404) return null;
			throw error;
		}
	};

export type RetentionAnswerResult = 'saved' | 'alreadyDecided';

/**
 * The guest's one answer to "keep my messages?". 409: the platform decides,
 * or the guest answered already (another tab) — nothing to ask any more.
 */
export const apiPutMessageRetention = async (
	keepMessages: boolean
): Promise<RetentionAnswerResult> => {
	try {
		await fetchData({
			url: `${endpoints.temporaryAccount}/message-retention`,
			method: FETCH_METHODS.PUT,
			bodyData: JSON.stringify({ keepMessages }),
			responseHandling: handled
		});
		return 'saved';
	} catch (error) {
		if (statusOf(error) === 409) return 'alreadyDecided';
		throw error;
	}
};
