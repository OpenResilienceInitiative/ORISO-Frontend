import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';

export interface AccountInviteDetails {
	recipientEmail: string;
	recipientFirstName: string;
	recipientLastName: string;
	targetRole: string;
	tenantId: number;
	agencyId: number;
	departmentId: number;
	expiresAt: string;
}

export interface AcceptAccountInvitePayload {
	username: string;
	password: string;
	formalLanguage: boolean;
}

export interface AcceptedAccountInvite {
	inviteStatus: string;
	provisioningStatus: string;
	provisionedUserId?: string;
}

export const getAccountInvite = (token: string): Promise<AccountInviteDetails> =>
	fetchData({
		url: endpoints.accountInvite(token),
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.NO_MATCH]
	});

export const acceptAccountInvite = (
	token: string,
	payload: AcceptAccountInvitePayload
): Promise<AcceptedAccountInvite> =>
	fetchData({
		url: `${endpoints.accountInvite(token)}/accept`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(payload),
		skipAuth: true,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.NO_MATCH,
			FETCH_SUCCESS.CONTENT
		]
	});
