import { logout } from '../components/logout/logout';
import { appConfig } from '../utils/appConfig';
import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from './fetchData';

/**
 * Bringing a colleague into a running members-only internal chat
 * (ORISO-UserService#1580). The room decides who can be invited: the
 * recipient scope of its owner and counselling centre, never the caller's.
 */
export interface InternalChatInvitationRecipient {
	consultantId: string;
	displayName: string;
	tenantName?: string;
	agencies: { id: number; name: string }[];
}

/**
 * `refused` is true when the server said no for good (403/409): the
 * colleague or the room no longer allows it. Everything else (busy, a
 * failed join) can be tried again.
 */
export class InternalChatInvitationError extends Error {
	readonly refused: boolean;

	constructor(
		readonly reason: string | undefined,
		readonly status?: number
	) {
		super(reason ?? `internal-chat-invitation-${status ?? 'failed'}`);
		this.name = 'InternalChatInvitationError';
		this.refused = status === 403 || status === 409;
	}
}

const chatUrl = (chatId: number, path: 'recipients' | 'participants') =>
	`${endpoints.internalSubsetChat}/${chatId}/${path}`;

const toError = (rejection: unknown): InternalChatInvitationError => {
	if (!(rejection instanceof Response)) {
		return new InternalChatInvitationError(undefined);
	}
	if (rejection.status === 401) {
		// `CATCH_ALL_WITH_RESPONSE` hands the response back before fetchData's
		// own 401 branch, so the expired session ends here.
		logout(true, appConfig.urls.toLogin);
	}
	return new InternalChatInvitationError(
		rejection.headers?.get(FETCH_ERRORS.X_REASON) ?? undefined,
		rejection.status
	);
};

export const apiGetInternalChatInvitationRecipients = async (
	chatId: number
): Promise<InternalChatInvitationRecipient[]> => {
	let response: unknown;
	try {
		response = await fetchData({
			url: chatUrl(chatId, 'recipients'),
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE]
		});
	} catch (rejection) {
		throw toError(rejection);
	}
	// 204 "nobody else can be invited" arrives as an empty object.
	return Array.isArray(response) ? response : [];
};

export const apiInviteInternalChatParticipant = async (
	chatId: number,
	consultantId: string
): Promise<void> => {
	try {
		await fetchData({
			url: chatUrl(chatId, 'participants'),
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify({ consultantId }),
			responseHandling: [FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE]
		});
	} catch (rejection) {
		throw toError(rejection);
	}
};
