import { fetchData, FETCH_ERRORS, FETCH_METHODS, FETCH_SUCCESS } from './index';
import { endpoints } from '../resources/scripts/endpoints';
import { FetchErrorWithOptions } from './fetchData';

export interface MagicLinkConsumeResponse {
	access_token: string;
	expires_in: number;
	refresh_token: string;
	refresh_expires_in: number;
}

export const apiConsumeMagicLinkLogin = async (
	token: string,
	otp?: string
): Promise<MagicLinkConsumeResponse> => {
	if (otp !== undefined && !/^[0-9]{6}$/.test(otp)) {
		throw new Error(FETCH_ERRORS.BAD_REQUEST);
	}
	try {
		return await fetchData({
			url: endpoints.magicLinkConsume,
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify({
				token,
				...(otp === undefined ? {} : { otp })
			}),
			skipAuth: true,
			responseHandling: [
				FETCH_SUCCESS.CONTENT,
				FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE,
				FETCH_ERRORS.UNAUTHORIZED
			]
		});
	} catch (error) {
		if (
			!(error instanceof Response) ||
			![400, 429].includes(error.status)
		) {
			throw error;
		}
		const body = await error.text();
		if (error.status === 400 && body === '') {
			throw new FetchErrorWithOptions(FETCH_ERRORS.BAD_REQUEST, {
				data: { error: 'invalid_grant' }
			});
		}
		if (body.length > 2048) throw new Error(FETCH_ERRORS.CATCH_ALL);
		let data: unknown;
		try {
			data = JSON.parse(body);
		} catch {
			throw new Error(FETCH_ERRORS.CATCH_ALL);
		}
		if (!isMagicLinkChallenge(data, error.status)) {
			throw new Error(FETCH_ERRORS.CATCH_ALL);
		}
		throw new FetchErrorWithOptions(
			error.status === 429
				? FETCH_ERRORS.TOO_MANY_REQUESTS
				: FETCH_ERRORS.BAD_REQUEST,
			{ data }
		);
	}
};

interface MagicLinkChallenge {
	error: 'invalid_grant';
	error_description: string;
	otpType: 'APP' | 'EMAIL';
	resendAvailableInSeconds?: number | null;
}

const isMagicLinkChallenge = (
	value: unknown,
	status: number
): value is MagicLinkChallenge => {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('error' in value) ||
		value.error !== 'invalid_grant' ||
		!('error_description' in value) ||
		typeof value.error_description !== 'string' ||
		value.error_description.length > 128 ||
		!('otpType' in value) ||
		typeof value.otpType !== 'string' ||
		!['APP', 'EMAIL'].includes(value.otpType) ||
		(status === 429 && value.otpType !== 'EMAIL') ||
		Object.keys(value).some(
			(key) =>
				![
					'error',
					'error_description',
					'otpType',
					'resendAvailableInSeconds'
				].includes(key)
		)
	)
		return false;
	if (
		'resendAvailableInSeconds' in value &&
		value.resendAvailableInSeconds !== null
	) {
		return (
			typeof value.resendAvailableInSeconds === 'number' &&
			Number.isInteger(value.resendAvailableInSeconds) &&
			value.resendAvailableInSeconds >= 0 &&
			value.resendAvailableInSeconds <= 2147483647
		);
	}
	return true;
};
