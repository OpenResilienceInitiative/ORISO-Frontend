import { apiFinishAnonymousConversation } from '../api/apiFinishAnonymousConversation';
import { FETCH_ERRORS } from '../api/fetchData';
import { fetchIsLastingLiveChatAccount } from '../components/liveChatConversion/lastingLiveChatAccount';
import { addEventListener, removeEventListener } from './eventHandler';
import { EVENT_PRE_LOGOUT } from '../components/logout/logout';
import {
	STATUS_ACTIVE,
	STATUS_EMPTY,
	STATUS_ENQUIRY,
	STATUS_FINISHED
} from '../globalState/interfaces/SessionsDataInterface';
let pendingSessionId: number | null = null;
let preLogoutListenerRegistered = false;

const isOpenAnonymousSessionStatus = (status: unknown): boolean => {
	const statusNum = Number(status);
	if (Number.isNaN(statusNum)) {
		return false;
	}
	return (
		statusNum === STATUS_EMPTY ||
		statusNum === STATUS_ENQUIRY ||
		statusNum === STATUS_ACTIVE
	);
};

export const registerAnonymousChatSessionForCleanup = (
	sessionId: number | null | undefined,
	sessionStatus?: unknown,
	matrixRoomId?: string | null,
	username?: string | null
): void => {
	if (
		sessionId == null ||
		(sessionStatus != null && !isOpenAnonymousSessionStatus(sessionStatus))
	) {
		pendingSessionId = null;
		return;
	}
	pendingSessionId = sessionId;
};

export const finishPendingAnonymousChatSession = async (): Promise<void> => {
	if (pendingSessionId == null) {
		return;
	}

	const sessionId = pendingSessionId;
	pendingSessionId = null;

	/* US#1601 (FE#2330): a converted account keeps its chat. Finishing it here
	   ended the Live Chat and hid its history on the next sign-in. When the
	   account state cannot be read, keep the chat as well: an abandoned guest
	   chat is expired server-side, a finished converted chat cannot be undone. */
	if ((await fetchIsLastingLiveChatAccount()) !== false) {
		return;
	}

	try {
		await apiFinishAnonymousConversation(sessionId);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : String(error ?? '');
		if (message !== FETCH_ERRORS.CONFLICT) {
			/* ignore — logout should still proceed */
		}
	}
};

const onPreLogout = async <T>(args?: T): Promise<T | undefined> => {
	await finishPendingAnonymousChatSession();
	return args;
};

export const ensureAnonymousChatPreLogoutCleanup = (): void => {
	if (preLogoutListenerRegistered) {
		return;
	}
	addEventListener(EVENT_PRE_LOGOUT, onPreLogout);
	preLogoutListenerRegistered = true;
};

export const teardownAnonymousChatPreLogoutCleanup = (): void => {
	if (!preLogoutListenerRegistered) {
		return;
	}
	removeEventListener(EVENT_PRE_LOGOUT, onPreLogout);
	preLogoutListenerRegistered = false;
};

/*
 * NOTE: there is intentionally no pagehide/unload hook here. pagehide fires
 * on plain page refreshes and navigations too, and finishing the anonymous
 * conversation there sets the session to DONE and deactivates the anonymous
 * Keycloak user — silently destroying an enquiry that is still waiting in
 * the consultant queue. Abandoned sessions are expired server-side by the
 * anonymous deactivate workflow; the client finishes only on explicit
 * logout (EVENT_PRE_LOGOUT above).
 */

export { STATUS_FINISHED, isOpenAnonymousSessionStatus };
