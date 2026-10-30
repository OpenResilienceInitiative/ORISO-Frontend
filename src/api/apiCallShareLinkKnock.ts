import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';

/**
 * The "Anklopfen" setting of a running call's share link
 * (ORISO-UserService#1488), for the switch inside the call (#1892,
 * ORISO-ElementCall#109). Reads the link, never creates one: creating it is
 * the share popover's job (#1794, PR #1910).
 *
 * The server lets every counsellor in the call read and change it, whoever
 * created the link (`CallShareLinkService.current/update`).
 */
export interface CallShareLinkKnock {
	id: number;
	knock: boolean;
}

export interface CallShareLinkCall {
	/** The conversation room behind the call (`CallData.signalRoomId`). */
	sourceRoomId: string;
	callId: string;
}

const parse = (value: unknown): CallShareLinkKnock | null => {
	if (!value || typeof value !== 'object') return null;
	const data = value as Record<string, unknown>;
	if (
		typeof data.id !== 'number' ||
		typeof data.knock !== 'boolean' ||
		data.active === false
	)
		return null;
	return { id: data.id, knock: data.knock };
};

/** No link for this call (404), or not this counsellor's call (403/404). */
const noLink = (error: unknown) =>
	error instanceof Error &&
	(error.message === FETCH_ERRORS.NO_MATCH ||
		error.message === FETCH_ERRORS.FORBIDDEN);

/**
 * The call's link, or `null` when it has none. Throws when the server did
 * not answer, so the caller can keep what it knew.
 */
export const apiGetCallShareLinkKnock = async (
	call: CallShareLinkCall
): Promise<CallShareLinkKnock | null> => {
	const query = new URLSearchParams({
		sourceRoomId: call.sourceRoomId,
		callId: call.callId
	});
	try {
		return parse(
			await fetchData({
				url: `${endpoints.matrixCallShareLinks}?${query.toString()}`,
				method: FETCH_METHODS.GET,
				responseHandling: [
					FETCH_SUCCESS.CONTENT,
					FETCH_ERRORS.FORBIDDEN,
					FETCH_ERRORS.NO_MATCH,
					FETCH_ERRORS.CATCH_ALL
				]
			})
		);
	} catch (error) {
		if (noLink(error)) return null;
		throw error;
	}
};

/** Changes only "Anklopfen"; resolves with what the server stored, throws when it did not land. */
export const apiSetCallShareLinkKnock = async (
	linkId: number,
	knock: boolean
): Promise<boolean> => {
	const link = parse(
		await fetchData({
			url: `${endpoints.matrixCallShareLinks}/${linkId}`,
			method: FETCH_METHODS.PATCH,
			bodyData: JSON.stringify({ knock }),
			responseHandling: [
				FETCH_SUCCESS.CONTENT,
				FETCH_ERRORS.FORBIDDEN,
				FETCH_ERRORS.NO_MATCH,
				FETCH_ERRORS.CATCH_ALL
			]
		})
	);
	if (!link) throw new Error(FETCH_ERRORS.CATCH_ALL);
	return link.knock;
};
