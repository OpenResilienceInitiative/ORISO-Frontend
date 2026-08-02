import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export interface SupportHandshake {
	id: string;
	purpose: 'SUPPORT_ACCESS';
	initiatorId: string;
	counterpartId: string;
	agencyId?: number;
	/**
	 * There is no EXPIRED here on purpose: a lapsed request leaves no row at all server-side, so it
	 * simply stops being returned. A client must never treat a stale object as still pending.
	 */
	status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
	expiryDate: string;
}

export interface SupportAccessSession {
	id: string;
	handshakeId: string;
	matrixRoomId: string | null;
	callMatrixRoomId: string | null;
	supportAdminId: string;
	supportAdminMatrixId: string | null;
	consultantId: string;
	agencyId?: number;
	/**
	 * Only PROVISIONING and ACTIVE are ever returned. Anything else has already lost access, which
	 * is why the absence of a session — not a status value — is what ends the local view.
	 */
	status: 'PROVISIONING' | 'ACTIVE';
	expiryDate: string;
}

const supportErrors = [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN];

export const apiGetPendingSupportHandshakes = (): Promise<SupportHandshake[]> =>
	fetchData({
		url: `${endpoints.supportAccessRequests}/pending`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN]
	});

/**
 * Both credentials travel together: Keycloak reports a missing second factor and a wrong password
 * identically, so the server cannot verify one without the other.
 */
export const apiConfirmSupportHandshake = (
	handshakeId: string,
	password: string,
	otp: string
): Promise<SupportHandshake> =>
	fetchData({
		url: `${endpoints.supportAccessRequests}/${encodeURIComponent(
			handshakeId
		)}/confirm`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ password, otp }),
		responseHandling: supportErrors
	});

/**
 * Explicitly refusing is a decision and is audited. Closing the dialog is not — it must leave the
 * request untouched so that "no reaction" really means nothing happened.
 */
export const apiDeclineSupportHandshake = (
	handshakeId: string
): Promise<SupportHandshake> =>
	fetchData({
		url: `${endpoints.supportAccessRequests}/${encodeURIComponent(
			handshakeId
		)}/decline`,
		method: FETCH_METHODS.POST,
		responseHandling: supportErrors
	});

export const apiGetActiveSupportSessions = (): Promise<
	SupportAccessSession[]
> =>
	fetchData({
		url: `${endpoints.supportAccessSessions}/active`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN]
	});

export const apiTerminateSupportSession = (sessionId: string): Promise<void> =>
	fetchData({
		url: `${endpoints.supportAccessSessions}/${encodeURIComponent(
			sessionId
		)}/terminate`,
		method: FETCH_METHODS.POST,
		responseHandling: supportErrors
	});

/**
 * Element Call creates its own media room. The backend has to know it, otherwise the four-hour
 * withdrawal closes the signalling room while the call keeps running.
 */
export const apiRegisterSupportCallRoom = (
	sessionId: string,
	callRoomId: string
): Promise<void> =>
	fetchData({
		url: `${endpoints.supportAccessSessions}/${encodeURIComponent(
			sessionId
		)}/call-room`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ callRoomId }),
		responseHandling: supportErrors
	});
