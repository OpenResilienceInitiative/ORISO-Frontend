import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from '../../api/fetchData';
import { endpoints } from '../../resources/scripts/endpoints';

export type ConversionState =
	| 'ELIGIBLE'
	| 'ALREADY_REGISTERED'
	| 'NOT_ELIGIBLE'
	| 'PROMOTION_PENDING'
	| 'PROMOTED'
	| 'CLEANUP_STARTED';
export interface ConversionStatus {
	userId: string;
	username: string;
	state: ConversionState;
	intentId: string | null;
}
const states: ConversionState[] = [
	'ELIGIBLE',
	'ALREADY_REGISTERED',
	'NOT_ELIGIBLE',
	'PROMOTION_PENDING',
	'PROMOTED',
	'CLEANUP_STARTED'
];
const handled = [FETCH_SUCCESS.CONTENT, FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE];

export const getConversionStatus = async (): Promise<ConversionStatus> => {
	const data = await fetchData({
		url: endpoints.liveChatConversion,
		method: FETCH_METHODS.GET,
		responseHandling: handled
	});
	if (
		!data ||
		typeof data.userId !== 'string' ||
		typeof data.username !== 'string' ||
		!data.username.trim() ||
		!data.userId ||
		!states.includes(data.state) ||
		(['PROMOTION_PENDING', 'PROMOTED'].includes(data.state) &&
			typeof data.intentId !== 'string')
	) {
		throw new Error('Invalid conversion status');
	}
	return {
		userId: data.userId,
		username: data.username,
		state: data.state,
		intentId: data.intentId ?? null
	};
};

export const convertLiveChatAccount = async (
	expectedUserId: string,
	intentId: string,
	password: string
): Promise<string> => {
	const data = await fetchData({
		url: endpoints.liveChatConversion,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			expectedUserId,
			intentId,
			password,
			recoveryKeySaved: true
		}),
		responseHandling: handled
	});
	if (typeof data?.username !== 'string' || !data.username.trim())
		throw new Error('Missing login name');
	return data.username;
};
